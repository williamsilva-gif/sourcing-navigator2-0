import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  stateCode,
  lookupKey,
  originalNumber,
  selectPlace,
  validatePlace,
  retryDelay,
  type GooglePlace,
  compare,
  inScope,
  parse,
  sheetRows,
  validateGeocode,
  workbook,
  type Entity,
  type Pair,
  type Mapping,
  type GoogleResult,
} from "./core";
const scope = z.object({ tenantId: z.string().uuid() });
const jobScope = scope.extend({ jobId: z.string().uuid() });
const json = (v: unknown): Json => JSON.parse(JSON.stringify(v));
async function authorize(s: SupabaseClient<Database>, tenantId: string) {
  const r = await s.rpc("proximity_access", { _tenant_id: tenantId });
  if (r.error || !r.data) throw new Error("Acesso restrito a TA master/staff neste cliente.");
}
async function get(s: SupabaseClient<Database>, tenantId: string, id: string) {
  await authorize(s, tenantId);
  const r = await s
    .from("proximity_jobs")
    .select("*")
    .eq("id", id)
    .eq("client_tenant_id", tenantId)
    .single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
export const proximityTenantsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
    if (!role.data) throw new Error("Acesso restrito a TA master/staff.");
    const r = await context.supabase.from("tenants").select("id,name").order("name");
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const proximityListFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const r = await context.supabase
      .from("proximity_jobs")
      .select("id,name,status,created_at")
      .eq("client_tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const proximityGetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobScope.parse(d))
  .handler(async ({ data, context }) => get(context.supabase, data.tenantId, data.jobId));
export const proximityCreateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ name: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const r = await context.supabase
      .from("proximity_jobs")
      .insert({ client_tenant_id: data.tenantId, name: data.name, created_by: context.userId })
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const proximityImportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope
      .extend({
        fileId: z.string().uuid(),
        filename: z
          .string()
          .min(1)
          .max(250)
          .regex(/\.(xlsx|csv)$/i),
        sheet: z.string().min(1).max(100),
        headerRow: z.number().int().min(1).max(100),
        kind: z.enum(["hotel", "office", "store"]),
        mapping: z.record(
          z.enum([
            "name",
            "code",
            "address",
            "number",
            "city",
            "uf",
            "cep",
            "document",
            "rn",
            "block",
            "active",
          ]),
          z.number().int().min(0).max(300),
        ),
        confirmed: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status === "running" || (job.lease_until && Date.parse(job.lease_until) > Date.now()))
      throw new Error("Pause e aguarde o lote em andamento antes de importar.");
    const path = `${data.tenantId}/${data.jobId}/${data.fileId}.${data.filename.split(".").pop()?.toLowerCase()}`;
    const file = await context.supabase.storage.from("proximity-originals").download(path);
    if (file.error || !file.data) throw new Error("Arquivo privado indisponível.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const w = workbook(bytes);
    const added = parse(
      sheetRows(w, data.sheet),
      data.headerRow,
      data.mapping as Mapping,
      data.kind,
      data.filename,
      data.sheet,
    );
    if (!added.length || added.length > 5000)
      throw new Error("Importação deve conter 1–5000 linhas.");
    const entities = [...(job.entities as unknown as Entity[]), ...added];
    if (entities.length > 10000) throw new Error("Limite de 10.000 linhas por análise.");
    const counts = new Map<string, number>();
    entities
      .filter((e) => e.kind !== "hotel" && e.code)
      .forEach((e) =>
        counts.set(`${e.kind}:${e.code}`, (counts.get(`${e.kind}:${e.code}`) ?? 0) + 1),
      );
    entities.forEach((e) => {
      if (e.kind !== "hotel" && (counts.get(`${e.kind}:${e.code}`) ?? 0) > 1) {
        e.active = false;
        if (!e.issues.includes("Código duplicado")) e.issues.push("Código duplicado");
      }
    });
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const imports = [
      ...(job.imports as unknown as unknown[]),
      {
        filename: data.filename,
        path,
        sheet: data.sheet,
        headerRow: data.headerRow,
        mapping: data.mapping,
        kind: data.kind,
        count: added.length,
        sha256: hash,
        at: new Date().toISOString(),
      },
    ];
    const r = await context.supabase
      .from("proximity_jobs")
      .update({
        entities: json(entities),
        imports: json(imports),
        pairs: [],
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("client_tenant_id", data.tenantId);
    if (r.error) throw new Error(r.error.message);
    return { count: added.length };
  });
export const proximityControlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope.extend({ status: z.enum(["running", "paused", "cancelled"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const r = await context.supabase
      .from("proximity_jobs")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .eq("client_tenant_id", data.tenantId);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
async function google(path: string, init?: RequestInit) {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY não configurada.");
  // Existing project uses a directly supplied server key. Gateway mode is explicit, never inferred from an unrelated Lovable key.
  const gateway = process.env["PROXIMITY_GOOGLE_GATEWAY"] === "true";
  const auth = process.env["LOVABLE_API_KEY"];
  if (gateway && !auth) throw new Error("Credencial de conexão Google ausente.");
  const url = gateway
    ? `https://connector-gateway.lovable.dev/google_maps${path}`
    : path.startsWith("/places/")
      ? `https://places.googleapis.com${path.slice(7)}`
      : `https://maps.googleapis.com${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  const headers = new Headers(init?.headers);
  if (!gateway && path.startsWith("/places/")) headers.set("X-Goog-Api-Key", key);
  if (gateway) {
    headers.set("Authorization", `Bearer ${auth}`);
    headers.set("X-Connection-Api-Key", key);
  }
  const r = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const body = await r.text();
    if (r.status === 403) {
      if (body.includes("API_KEY_HTTP_REFERRER_BLOCKED"))
        throw new Error(
          "Google 403: chave servidor restrita por site. No Google Cloud, use restrição por IP ou None somente para a chave servidor.",
        );
      if (body.includes("API_KEY_SERVICE_BLOCKED"))
        throw new Error(
          "Google 403: habilite a API solicitada e inclua-a nas APIs permitidas da chave servidor.",
        );
      throw new Error(
        "Google negou acesso (403): verifique restrições e APIs habilitadas da chave servidor.",
      );
    }
    throw new Error(`Google HTTP ${r.status}: ${body.slice(0, 300).replaceAll(key, "[REDACTED]")}`);
  }
  return r.json();
}
const placeMask = "id,displayName,formattedAddress,location,types,addressComponents,businessStatus";
async function placeDetails(id: string): Promise<GooglePlace> {
  return google(`/places/v1/places/${encodeURIComponent(id)}?languageCode=pt-BR`, {
    headers: { "X-Goog-FieldMask": placeMask },
  });
}
async function establishment(e: Entity, count: () => void) {
  count();
  const result = (await google("/places/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-FieldMask": `places.${placeMask.split(",").join(",places.")},nextPageToken`,
    },
    body: JSON.stringify({
      textQuery: [
        e.name,
        municipalityForQuery(e),
        e.uf,
        e.kind === "hotel" ? "hotel" : e.address,
        "Brasil",
      ]
        .filter(Boolean)
        .join(", "),
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 5,
      ...(e.kind === "hotel" ? { includedType: "lodging", strictTypeFiltering: true } : {}),
    }),
  })) as { places?: GooglePlace[]; nextPageToken?: string };
  const selected = selectPlace(e, result.places ?? [], !!result.nextPageToken);
  if (!selected.place)
    return {
      failure: selected.ambiguous
        ? "Estabelecimento ambíguo: revisão TA necessária"
        : "Estabelecimento não localizado: revisão TA necessária",
    };
  count();
  const details = await placeDetails(selected.place.id ?? "");
  if (details.id !== selected.place.id)
    return { failure: "Place ID incoerente: revisão TA necessária" };
  return { geo: validatePlace(e, details, selected.ambiguous) };
}
export const proximityBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobScope.parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, data.tenantId);
    const token = crypto.randomUUID();
    const claim = await context.supabase.rpc("proximity_claim", {
      _job_id: data.jobId,
      _tenant_id: data.tenantId,
      _token: token,
    });
    if (claim.error) throw new Error(claim.error.message);
    const job = claim.data?.[0];
    if (!job) return { busy: true };
    const entities = job.entities as unknown as Entity[];
    let error = "";
    let calls = 0;
    try {
      const pending = entities.filter(
        (e) => inScope(e, entities) && !e.attempted && (!e.nextRetry || e.nextRetry <= Date.now()),
      );
      const keys = [...new Set(pending.map(lookupKey))].slice(0, 2);
      for (const key of keys) {
        const live = await context.supabase
          .from("proximity_jobs")
          .select("status")
          .eq("id", job.id)
          .single();
        if (live.data?.status !== "running") break;
        const e = pending.find((v) => lookupKey(v) === key);
        if (!e) continue;
        const prior = entities.find((v) => lookupKey(v) === key && v.attempted && v.geo);
        let geo = prior?.geo;
        let failure = "";
        let retry = false;
        try {
          if (!geo && (!e.city || !/^[a-z]{2}$/i.test(stateCode(e.uf)) || !e.name)) {
            failure = "Nome ou município/UF incompleto: revisão TA necessária";
          } else if (!geo && (!originalNumber(e) || !e.address)) {
            const found = await establishment(e, () => calls++);
            geo = found.geo;
            failure = found.failure ?? "";
          } else if (!geo) {
            calls++;
            const city = municipalityForQuery(e);
            const query = [e.address, e.number, city, e.uf, e.cep, "Brasil"]
              .filter(Boolean)
              .join(", ");
            const response = (await google(
              `/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=pt-BR&region=br`,
            )) as { status: string; results?: GoogleResult[] };
            if (response.status === "OK" && response.results?.length) {
              const valid = response.results.map((r) => validateGeocode(e, r));
              const high = valid.filter((g) => g.confidence === "high");
              if (high.length === 1 && valid.length === 1) geo = high[0];
              else if (valid.length === 1) {
                geo = valid[0];
                const found = await establishment(e, () => calls++);
                if (found.geo) geo = found.geo;
                else failure = found.failure ?? "";
              } else failure = "Geocoding ambíguo: revisão TA necessária";
            } else if (["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"].includes(response.status)) {
              failure = `Google ${response.status}`;
              retry = true;
            } else if (response.status === "REQUEST_DENIED")
              throw new Error(
                "Google REQUEST_DENIED: chave servidor/API Geocoding não autorizada.",
              );
            else if (response.status === "ZERO_RESULTS") {
              const found = await establishment(e, () => calls++);
              geo = found.geo;
              failure = found.failure ?? "";
            } else failure = `Google ${response.status}: não localizado`;
          }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Falha Google";
          if (/429|HTTP 5\d\d|timeout|timed out|fetch failed|network/i.test(message)) {
            retry = true;
            failure = "Falha temporária Google/rede: nova tentativa agendada";
          } else throw cause;
        }
        entities
          .filter((v) => lookupKey(v) === key)
          .forEach((v) => {
            v.attempts = (v.attempts ?? 0) + 1;
            v.attempted = !retry || v.attempts >= 3;
            v.geo = geo;
            v.nextRetry = retry && !v.attempted ? Date.now() + retryDelay(v.attempts) : undefined;
            v.lastAttemptError = failure || undefined;
            if (failure && !v.issues.includes(failure)) v.issues.push(failure);
          });
        // Per-address durable checkpoint; lease owner only.
        const saved = await context.supabase
          .from("proximity_jobs")
          .update({
            entities: json(entities),
            checkpoint: entities.filter((v) => v.attempted).length,
          })
          .eq("id", job.id)
          .eq("lease_token", token);
        if (saved.error) throw new Error(saved.error.message);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha de processamento";
    }
    const pending = entities.some((e) => inScope(e, entities) && !e.attempted);
    const patch = {
      entities: json(entities),
      pairs: json(compare(entities)),
      lease_token: null,
      lease_until: null,
      next_batch_at: new Date(Date.now() + 1500).toISOString(),
      last_error: error || null,
      updated_at: new Date().toISOString(),
    };
    const finish = await context.supabase
      .from("proximity_jobs")
      .update(patch)
      .eq("id", job.id)
      .eq("lease_token", token);
    if (finish.error) throw new Error(finish.error.message);
    if (error || !pending)
      await context.supabase
        .from("proximity_jobs")
        .update({ status: error ? "paused" : "completed" })
        .eq("id", job.id)
        .eq("status", "running");
    return { busy: false, calls, error, pending };
  });
function municipalityForQuery(e: Entity) {
  return normCity(e) === "saopaulo" ? "São Paulo" : e.city;
}
function normCity(e: Entity) {
  return cityKey(e).split(":")[0];
}
import { cityKey } from "./core";
export const proximityCompareFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope.extend({ allowCross: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status === "running") throw new Error("Pause para recalcular.");
    const pairs = compare(job.entities as unknown as Entity[], data.allowCross);
    const r = await context.supabase
      .from("proximity_jobs")
      .update({ pairs: json(pairs) })
      .eq("id", job.id);
    if (r.error) throw new Error(r.error.message);
    return { count: pairs.length };
  });
export const proximityManualFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    jobScope
      .extend({
        entityId: z.string().uuid(),
        placeId: z.string().min(5).max(250),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status === "running" || (job.lease_until && Date.parse(job.lease_until) > Date.now()))
      throw new Error("Pause e aguarde o lote.");
    const entities = job.entities as unknown as Entity[];
    const entity = entities.find((e) => e.id === data.entityId);
    if (!entity) throw new Error("Endereço não encontrado.");
    const r = await placeDetails(data.placeId);
    if (r.id !== data.placeId) throw new Error("Place ID incoerente.");
    entity.geo = validatePlace(entity, r);
    entity.geo.source = `Google Place — revisão TA: ${data.reason}`;
    entity.attempted = true;
    const saved = await context.supabase
      .from("proximity_jobs")
      .update({ entities: json(entities), pairs: json(compare(entities)) })
      .eq("id", job.id);
    if (saved.error) throw new Error(saved.error.message);
    return { confidence: entity.geo.confidence };
  });
export const proximityRoutesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobScope.extend({ hotelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const job = await get(context.supabase, data.tenantId, data.jobId);
    if (job.status === "running") throw new Error("Pause antes de calcular rotas.");
    const entities = job.entities as unknown as Entity[];
    const pairs = job.pairs as unknown as Pair[];
    const h = entities.find((e) => e.id === data.hotelId);
    if (!h?.geo) throw new Error("Hotel sem coordenadas.");
    // Routes lives at a different host in direct-key deployments.
    const key = process.env["GOOGLE_MAPS_API_KEY"];
    if (!key) throw new Error("Chave Google ausente.");
    for (const kind of ["office", "store"])
      for (const pair of pairs
        .filter((p) => p.hotelId === h.id && p.kind === kind)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)) {
        if (pair.roadKm !== undefined) continue;
        const u = entities.find((e) => e.id === pair.unitId);
        if (!u?.geo) continue;
        const gateway = process.env["PROXIMITY_GOOGLE_GATEWAY"] === "true";
        const auth = process.env["LOVABLE_API_KEY"];
        if (gateway && !auth) throw new Error("Conexão Google ausente.");
        const res = await fetch(
          gateway
            ? "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes"
            : "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-FieldMask": "routes.distanceMeters",
              ...(gateway
                ? { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key }
                : { "X-Goog-Api-Key": key }),
            },
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: h.geo.lat, longitude: h.geo.lng } } },
              destination: { location: { latLng: { latitude: u.geo.lat, longitude: u.geo.lng } } },
              travelMode: "DRIVE",
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!res.ok)
          throw new Error(
            `Google Routes ${res.status}: habilite Routes API e confira a chave servidor.`,
          );
        const body = (await res.json()) as { routes?: Array<{ distanceMeters?: number }> };
        if (!body.routes?.length) throw new Error("Rota viária não encontrada.");
        pair.roadKm = (body.routes[0].distanceMeters ?? 0) / 1000;
        pair.roadSource = "Google Routes DRIVE";
        const saved = await context.supabase
          .from("proximity_jobs")
          .update({ pairs: json(pairs) })
          .eq("id", job.id);
        if (saved.error) throw new Error(saved.error.message);
      }
    return { ok: true };
  });
