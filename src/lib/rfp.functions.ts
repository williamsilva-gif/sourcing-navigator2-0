import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

// ----- Shared types -----
export interface RfpRecord {
  id: string;
  name: string;
  client_tenant_id: string;
  client_name: string;
  status: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  pois: Json;
  metadata: Json;
  invited_count: number;
  responded_count: number;
}

export interface InvitationRecord {
  id: string;
  rfp_id: string;
  hotel_id: string;
  hotel_name?: string;
  hotel_city?: string;
  hotel_email?: string;
  status: string;
  deadline: string | null;
  created_at: string;
}

export interface ResponseRecord {
  id: string;
  rfp_id: string;
  hotel_id: string;
  rates: Json;
  submitted_at: string;
}

const rfpQuestionsSchema = z
  .object({
    rates: z.boolean().optional(),
    inclusions: z.boolean().optional(),
    policies: z.boolean().optional(),
    sustainability: z.boolean().optional(),
    capacity: z.boolean().optional(),
    commercial: z.boolean().optional(),
  })
  .partial();

const createRfpSchema = z.object({
  name: z.string().min(1).max(200),
  clientTenantId: z.string().uuid(),
  cycle: z.string().min(1).max(20),
  briefing: z.string().max(2000).default(""),
  cities: z.array(z.string().min(1).max(100)).min(1).max(50),
  pois: z.array(z.any()).default([]),
  hotelStrategy: z.enum(["preferred", "open", "curated"]).default("preferred"),
  requirements: z.array(z.string()).default([]),
  questions: rfpQuestionsSchema.default({}),
  openDate: z.string().min(1),
  deadline: z.string().min(1),
  hotelIds: z.array(z.string().uuid()).min(1).max(500),
  suggestedCap: z.number().optional(),
});

export const createRfpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createRfpSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const meta = {
      cycle: data.cycle,
      briefing: data.briefing,
      cities: data.cities,
      requirements: data.requirements,
      questions: data.questions,
      openDate: data.openDate,
      hotelStrategy: data.hotelStrategy,
      suggestedCap: data.suggestedCap ?? null,
    };
    const { data: rfp, error } = await supabase
      .from("rfps")
      .insert({
        name: data.name,
        client_tenant_id: data.clientTenantId,
        status: "Em distribuição",
        deadline: data.deadline,
        pois: data.pois as never,
        metadata: meta as never,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const invites = data.hotelIds.map((hid) => ({
      rfp_id: rfp.id,
      hotel_id: hid,
      status: "Não respondeu",
      deadline: data.deadline,
    }));
    const { data: invRows, error: invErr } = await supabase
      .from("rfp_invitations")
      .insert(invites)
      .select("id, hotel_id");
    if (invErr) throw new Error(invErr.message);

    return { rfpId: rfp.id, invitations: invRows ?? [] };
  });

export const listRfpsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RfpRecord[]> => {
    const { supabase } = context;
    const { data: rfps, error } = await supabase
      .from("rfps")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (rfps ?? []).map((r) => r.id);
    const tenantIds = Array.from(new Set((rfps ?? []).map((r) => r.client_tenant_id)));

    const [{ data: invs }, { data: resps }, { data: tenants }] = await Promise.all([
      ids.length
        ? supabase.from("rfp_invitations").select("rfp_id").in("rfp_id", ids)
        : Promise.resolve({ data: [] as { rfp_id: string }[] }),
      ids.length
        ? supabase.from("rfp_responses").select("rfp_id").in("rfp_id", ids)
        : Promise.resolve({ data: [] as { rfp_id: string }[] }),
      tenantIds.length
        ? supabase.from("tenants").select("id, name").in("id", tenantIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const invByRfp = new Map<string, number>();
    (invs ?? []).forEach((i) => invByRfp.set(i.rfp_id, (invByRfp.get(i.rfp_id) ?? 0) + 1));
    const respByRfp = new Map<string, number>();
    (resps ?? []).forEach((r) => respByRfp.set(r.rfp_id, (respByRfp.get(r.rfp_id) ?? 0) + 1));
    const tenantNames = new Map<string, string>();
    (tenants ?? []).forEach((t) => tenantNames.set(t.id, t.name));

    return (rfps ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      client_tenant_id: r.client_tenant_id,
      client_name: tenantNames.get(r.client_tenant_id),
      status: r.status,
      deadline: r.deadline,
      created_at: r.created_at,
      updated_at: r.updated_at,
      pois: r.pois,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      invited_count: invByRfp.get(r.id) ?? 0,
      responded_count: respByRfp.get(r.id) ?? 0,
    }));
  });

export const getRfpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rfp, error } = await supabase.from("rfps").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);

    const [{ data: invs }, { data: resps }] = await Promise.all([
      supabase.from("rfp_invitations").select("*").eq("rfp_id", data.id),
      supabase.from("rfp_responses").select("*").eq("rfp_id", data.id),
    ]);

    const hotelIds = Array.from(new Set((invs ?? []).map((i) => i.hotel_id)));
    const { data: hotels } = hotelIds.length
      ? await supabase.from("hotels").select("id, name, city, contact_email").in("id", hotelIds)
      : { data: [] as { id: string; name: string; city: string; contact_email: string | null }[] };

    const hotelById = new Map(
      (hotels ?? []).map((h) => [
        h.id,
        { name: h.name, city: h.city, email: h.contact_email ?? "" },
      ]),
    );

    const respByInv = new Set((resps ?? []).map((r) => r.hotel_id));

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", rfp.client_tenant_id)
      .single();

    return {
      rfp: {
        ...rfp,
        client_name: tenant?.name ?? "",
        metadata: (rfp.metadata ?? {}) as Record<string, unknown>,
      },
      invitations: (invs ?? []).map((i) => {
        const h = hotelById.get(i.hotel_id);
        return {
          id: i.id,
          rfp_id: i.rfp_id,
          hotel_id: i.hotel_id,
          hotel_name: h?.name ?? "Hotel",
          hotel_city: h?.city ?? "",
          hotel_email: h?.email ?? "",
          status: respByInv.has(i.hotel_id) ? "Submetido" : i.status,
          deadline: i.deadline,
          created_at: i.created_at,
        } as InvitationRecord;
      }),
      responses: (resps ?? []) as ResponseRecord[],
    };
  });

// ===== Public (no auth) — used by the hotel response page =====

function publicAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getInvitationByTokenFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicAdminClient();
    const { data: inv, error } = await supabase
      .from("rfp_invitations")
      .select("*")
      .eq("id", data.token)
      .single();
    if (error || !inv) throw new Error("Convite não encontrado");

    const [{ data: rfp }, { data: hotel }, { data: existing }] = await Promise.all([
      supabase.from("rfps").select("*").eq("id", inv.rfp_id).single(),
      supabase.from("hotels").select("id, name, city, contact_email").eq("id", inv.hotel_id).single(),
      supabase.from("rfp_responses").select("*").eq("rfp_id", inv.rfp_id).eq("hotel_id", inv.hotel_id).maybeSingle(),
    ]);
    if (!rfp) throw new Error("RFP não encontrado");

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", rfp.client_tenant_id)
      .single();

    return {
      invitation: {
        id: inv.id,
        rfp_id: inv.rfp_id,
        status: inv.status,
        deadline: inv.deadline,
      },
      rfp: {
        id: rfp.id,
        name: rfp.name,
        deadline: rfp.deadline,
        client_name: tenant?.name ?? "",
        metadata: (rfp.metadata ?? {}) as Record<string, unknown>,
      },
      hotel: hotel
        ? { id: hotel.id, name: hotel.name, city: hotel.city }
        : null,
      existingResponse: existing
        ? { rates: (existing.rates ?? {}) as Record<string, unknown>, submitted_at: existing.submitted_at }
        : null,
    };
  });

const submitResponseSchema = z.object({
  token: z.string().uuid(),
  rates: z.record(z.string(), z.any()),
});

export const submitInvitationResponseFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitResponseSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicAdminClient();
    const { data: inv, error } = await supabase
      .from("rfp_invitations")
      .select("id, rfp_id, hotel_id")
      .eq("id", data.token)
      .single();
    if (error || !inv) throw new Error("Convite inválido");

    const { data: existing } = await supabase
      .from("rfp_responses")
      .select("id")
      .eq("rfp_id", inv.rfp_id)
      .eq("hotel_id", inv.hotel_id)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase
        .from("rfp_responses")
        .update({ rates: data.rates as never, submitted_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: insErr } = await supabase.from("rfp_responses").insert({
        rfp_id: inv.rfp_id,
        hotel_id: inv.hotel_id,
        rates: data.rates as never,
      });
      if (insErr) throw new Error(insErr.message);
    }

    await supabase
      .from("rfp_invitations")
      .update({ status: "Submetido" })
      .eq("id", inv.id);

    return { ok: true };
  });
