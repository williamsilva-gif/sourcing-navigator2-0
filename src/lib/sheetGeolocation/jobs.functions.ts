import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { google } from "../proximity/google.server";
import { selectPlace, stateCode, type GoogleResult, type GooglePlace } from "../proximity/core";
import {
  cacheKey,
  counts,
  parseSheet,
  query,
  validate,
  validateSheetPlace,
  transientFailure,
  retryAt,
  completedJob,
  fatalFailure,
  SheetJobFatal,
  readWorkbook as workbook,
  type Row,
  type Mapping,
} from "./core";
const scope = z.object({ tenantId: z.string().uuid() });
const jobScope = scope.extend({ jobId: z.string().uuid() });
const json = (v: unknown): Json => JSON.parse(JSON.stringify(v));
async function authorize(s: SupabaseClient<Database>, tenant: string) {
  const r = await s.rpc("proximity_access", { _tenant_id: tenant });
  if (r.error || !r.data) throw new Error("Acesso restrito à TA neste cliente.");
}
async function get(s: SupabaseClient<Database>, tenant: string, id: string) {
  await authorize(s, tenant);
  const r = await s
    .from("sheet_geolocation_jobs")
    .select("*")
    .eq("id", id)
    .eq("client_tenant_id", tenant)
    .single();
  if (r.error) throw new Error(r.error.message);
  // Snapshot CAS: recognize only fully checkpointed paused jobs; never process on reads.
  if (completedJob(r.data)) {
    const normalized = await s.from("sheet_geolocation_jobs")
      .update({ status: "processed", lease_token: null, lease_until: null, next_batch_at: null,
        last_error: null, updated_at: new Date().toISOString() })
      .eq("id", id).eq("client_tenant_id", tenant).eq("status", "paused")
      .eq("checkpoint", (r.data.rows as unknown as Row[]).length)
      .eq("rows", JSON.stringify(r.data.rows)).eq("updated_at", r.data.updated_at)
      .select().maybeSingle();
    if (normalized.error) throw new Error("Não foi possível reconhecer a conclusão persistida.");
    if (normalized.data) return normalized.data;
    const fresh = await s.from("sheet_geolocation_jobs").select("*")
      .eq("id", id).eq("client_tenant_id", tenant).single();
    if (fresh.error) throw new Error(fresh.error.message);
    return fresh.data;
  }
  return r.data;
}
export const listSheetJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const r = await context.supabase
      .from("sheet_geolocation_jobs")
      .select("id,filename,sheet,status,checkpoint,created_at")
      .eq("client_tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const getSheetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobScope.parse(d))
  .handler(async ({ data, context }) => get(context.supabase, data.tenantId, data.jobId));
export const createSheetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope
      .extend({
        filename: z
          .string()
          .max(250)
          .regex(/\.(xlsx|csv)$/i),
        kind: z.enum(["hotel", "office", "store"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const id = crypto.randomUUID();
    const path = `${data.tenantId}/${id}/original.${data.filename.split(".").pop()?.toLowerCase()}`;
    const r = await context.supabase
      .from("sheet_geolocation_jobs")
      .insert({
        id,
        client_tenant_id: data.tenantId,
        created_by: context.userId,
        filename: data.filename,
        storage_path: path,
        kind: data.kind,
      })
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const importSheetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope
      .extend({
        sheet: z.string().min(1).max(100),
        header: z.number().int().min(1).max(100),
        mapping: z.record(
          z.enum([
            "name",
            "code",
            "address",
            "number",
            "district",
            "city",
            "cep",
            "complement",
            "uf",
          ]),
          z.number().int().min(0).max(300),
        ),
        budget: z.number().int().min(1).max(6000),
        confirmed: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status !== "draft")
      throw new Error("Importação já confirmada; abra o processamento existente.");
    const f = await context.supabase.storage
      .from("sheet-geolocation-originals")
      .download(job.storage_path);
    if (f.error || !f.data) throw new Error("Arquivo original privado indisponível.");
    const bytes = new Uint8Array(await f.data.arrayBuffer());
    const book = workbook(bytes);
    const rows = parseSheet(
      book,
      data.sheet,
      data.header,
      data.mapping as Mapping,
      job.kind as "hotel" | "office" | "store",
      job.filename,
    );
    if (!rows.length) throw new Error("Nenhuma linha após o cabeçalho.");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const r = await context.supabase
      .from("sheet_geolocation_jobs")
      .update({
        sheet: data.sheet,
        header_row: data.header,
        mapping: json(data.mapping),
        rows: json(rows),
        file_hash: hash,
        request_budget: data.budget,
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "draft")
      .select()
      .single();
    if (r.error)
      throw new Error(
        r.error.code === "23505"
          ? "Esta aba e mapeamento já foram importados; reabra o processamento existente."
          : r.error.message,
      );
    return r.data;
  });
export const controlSheetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope
      .extend({
        status: z.enum(["running", "paused", "cancelled"]),
        confirmedCost: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status === "draft") throw new Error("Confirme primeiro a importação.");
    if (job.status === "processed") return { ok: true };
    if (data.status === "running" && !data.confirmedCost)
      throw new Error("Confirme o custo das consultas Google.");
    if (data.status === "running" && job.requests_reserved >= job.request_budget)
      throw new Error("Limite de consultas atingido; resultado parcial disponível.");
    const r = await context.supabase
      .from("sheet_geolocation_jobs")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("client_tenant_id", data.tenantId);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
const mask = "id,displayName,formattedAddress,location,types,addressComponents,businessStatus";
export const batchSheetJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobScope.parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const token = crypto.randomUUID();
    const claim = await context.supabase.rpc("sheet_geo_claim", {
      _job_id: data.jobId,
      _tenant_id: data.tenantId,
      _token: token,
    });
    if (claim.error) throw new Error(claim.error.message);
    const job = claim.data?.[0];
    if (!job) return { busy: true };
    const rows = job.rows as unknown as Row[];
    let reserved = job.requests_reserved;
    let error = "";
    const started = Date.now();
    const request = async (path: string, init?: RequestInit) => {
      if (reserved >= job.request_budget) {
        throw new SheetJobFatal("Limite de consultas atingido; resultado parcial disponível.");
      }
      // Reserve before network I/O. A crash may consume a reserved unit, never exceed the user-approved cap.
      reserved++;
      const r = await context.supabase
        .from("sheet_geolocation_jobs")
        .update({ requests_reserved: reserved })
        .eq("id", job.id)
        .eq("lease_token", token)
        .eq("status", "running")
        .select("id");
      if (r.error) throw new SheetJobFatal("Falha de persistência da reserva; processamento interrompido.");
      if (!r.data?.length) throw new SheetJobFatal("Processamento pausado ou lease expirado.");
      return google(path, init);
    };
    try {
      for (const row of rows
        .filter((r) => r.status === "pending" && (!r.nextRetry || r.nextRetry <= Date.now()))
        .slice(0, 3)) {
        if (Date.now() - started > 25000) break;
        const live = await context.supabase
          .from("sheet_geolocation_jobs")
          .select("status")
          .eq("id", job.id)
          .single();
        if (live.error) throw new SheetJobFatal("Falha de persistência ao conferir o processamento.");
        if (live.data?.status !== "running") break;
        const previous = rows.find(
          (r) => r !== row && (r.status === "high" || r.status === "review") && r.geo && cacheKey(r) === cacheKey(row),
        );
        try {
          if (previous) {
            row.geo = previous.geo;
            row.precision = previous.precision;
            row.status = previous.status;
            row.notes = [
              ...previous.notes,
              "Resposta reaproveitada de endereço/identidade idênticos neste arquivo",
            ];
          } else if (
            !row.entity.address ||
            !row.entity.city ||
            !/^[a-z]{2}$/.test(stateCode(row.entity.uf))
          ) {
            row.status = "review";
          } else {
            row.attempts++;
            const response = (await request(
              `/maps/api/geocode/json?address=${encodeURIComponent(query(row))}&language=pt-BR&region=br`,
            )) as { status: string; results?: GoogleResult[] };
            if (!response || typeof response.status !== "string")
              throw new Error("Resposta Google malformada: status ausente.");
            if (response.status === "UNKNOWN_ERROR")
              throw new Error(`Google transiente ${response.status}`);
            if (["REQUEST_DENIED", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"].includes(response.status))
              throw new SheetJobFatal(`Google ${response.status}: verifique autorização ou quota antes de retomar.`);
            const results = response.results ?? [];
            if (!Array.isArray(results)) throw new Error("Resposta Google malformada: resultados inválidos.");
            if (results.length === 1) {
              row.geo = validate(row, results[0]);
              row.precision = results[0].geometry.location_type;
              row.status = row.geo.confidence;
              row.notes = row.geo.reasons;
            } else {
              row.status = results.length ? "review" : "error";
              row.notes = [
                results.length
                  ? "Múltiplos resultados: revisão necessária"
                  : `Google ${response.status}: sem resultado`,
              ];
            }
            if (row.entity.kind === "hotel" && row.entity.name && row.status !== "high") {
              const search = (await request("/places/v1/places:searchText", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Goog-FieldMask": `places.${mask.split(",").join(",places.")},nextPageToken`,
                },
                body: JSON.stringify({
                  textQuery: `${row.entity.name}, ${query(row)}`,
                  includedType: "lodging",
                  strictTypeFiltering: true,
                  languageCode: "pt-BR",
                  regionCode: "BR",
                  pageSize: 5,
                }),
              })) as { places?: GooglePlace[]; nextPageToken?: string };
              const selected = selectPlace(row.entity, search.places ?? [], !!search.nextPageToken);
              if (selected.place?.id) {
                const place = (await request(
                  `/places/v1/places/${encodeURIComponent(selected.place.id)}?languageCode=pt-BR`,
                  { headers: { "X-Goog-FieldMask": mask } },
                )) as GooglePlace;
                if (place.id !== selected.place.id)
                  throw new Error("Place ID incoerente: revisão necessária.");
                row.geo = validateSheetPlace(row.entity, place, !selected.ambiguous);
                row.precision = "Identidade por estabelecimento (Places; sem ROOFTOP)";
                row.status = row.geo.confidence;
                row.notes = row.geo.reasons;
              } else {
                row.status = "review";
                row.notes.push(
                  selected.ambiguous
                    ? "Identidade ambígua; nenhum primeiro resultado aceito"
                    : "Identidade hoteleira não confirmada",
                );
              }
            }
          }
          row.nextRetry = undefined;
        } catch (cause) {
          const message = cause instanceof TypeError ? "Resposta Google malformada: estrutura inválida para esta linha." : cause instanceof Error ? cause.message : "Falha Google";
          const transient = transientFailure(message);
          if (cause instanceof SheetJobFatal || fatalFailure(message)) {
            error = message;
            row.status = "pending";
            row.nextRetry = undefined;
            row.notes = [...row.notes, message];
          } else if (transient && row.attempts < 3) {
            row.status = "pending";
            row.nextRetry = retryAt(message, row.attempts, Date.now());
            row.notes = [`Falha temporária; nova tentativa agendada: ${message}`];
          } else if (transient) {
            row.status = "error";
            row.nextRetry = undefined;
            row.notes = [`Falha temporária após três tentativas: ${message}`];
          } else {
            row.status = "error";
            row.nextRetry = undefined;
            row.notes = [message];
          }
        }
        row.history.push({
          at: new Date().toISOString(),
          status: row.status,
          notes: [...row.notes],
        });
        const saved = await context.supabase
          .from("sheet_geolocation_jobs")
          .update({
            rows: json(rows),
            checkpoint: counts(rows).total - counts(rows).pending,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("lease_token", token).select("id");
        if (saved.error || !saved.data?.length) throw new SheetJobFatal("Falha de persistência ou lease perdido; lote interrompido.");
        if (error) break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Falha no lote";
    }
    const stats = counts(rows);
    const retries = rows.filter((r) => r.status === "pending" && r.nextRetry).map((r) => r.nextRetry ?? 0);
    const next = retries.length && rows.every((r) => r.status !== "pending" || r.nextRetry)
      ? Math.min(...retries) : Date.now() + 1500;
    const finish = await context.supabase
      .from("sheet_geolocation_jobs")
      .update({
        lease_token: null,
        lease_until: null,
        status: error ? "paused" : stats.pending ? "running" : "processed",
        ...(error ? {} : { checkpoint: stats.total - stats.pending }),
        next_batch_at: !error && stats.pending ? new Date(next).toISOString() : null,
        last_error: error || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_token", token).eq("status", "running").select("id");
    if (finish.error) throw new Error(finish.error.message);
    if (!finish.data?.length) {
      // Explicit pause/cancel wins; release only our lease, without changing user state.
      const r = await context.supabase
        .from("sheet_geolocation_jobs")
        .update({ lease_token: null, lease_until: null })
        .eq("id", job.id)
        .eq("lease_token", token);
      if (r.error) throw new Error(r.error.message);
    }
    return { busy: false, error, counts: stats };
  });
