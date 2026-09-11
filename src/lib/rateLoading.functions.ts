// Rate Loading Check — server functions.
// Credentials are resolved server-side only; nothing secret is ever returned.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdapter } from "@/lib/rateLoading/adapters";
import { isUrlAllowed } from "@/lib/rateLoading/allowlist";
import { nightsBetween } from "@/lib/rateLoading/normalize";
import { snapshotHash } from "@/lib/rateLoading/snapshot";
import type { ExpectedRateSnapshot } from "@/lib/rateLoading/types";

export const RATE_LOADING_FEATURE_KEY = "RATE_LOADING";

// ---------------------------------------------------------------- helpers

// The middleware-provided client is fully typed; helpers accept it loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

async function assertTenantVisible(supabase: Db, userId: string, tenantId: string) {
  const { data } = await supabase.rpc("can_see_tenant", { _user_id: userId, _tenant_id: tenantId });
  if (data !== true) throw new Error("Acesso negado para este cliente.");
}

async function assertTaMaster(supabase: Db, userId: string) {
  const { data } = await supabase.rpc("is_ta_master", { _user_id: userId });
  if (data !== true) throw new Error("Apenas a Travel Academy pode executar esta ação.");
}

function periodKeyFor(period: string): string {
  const now = new Date();
  if (period === "annual") return `${now.getUTCFullYear()}`;
  if (period === "contract") return "contract";
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function audit(
  supabase: Db,
  row: {
    tenant_id: string;
    target_user_id: string;
    actor_user_id: string;
    action: string;
    key: string;
  },
) {
  await supabase.from("access_audit_log").insert({
    tenant_id: row.tenant_id,
    target_user_id: row.target_user_id,
    actor_user_id: row.actor_user_id,
    kind: "rate_loading",
    key: row.key,
    action: row.action,
  });
}

// ------------------------------------------------------- portal connections

export interface PortalConnectionDTO {
  id: string;
  displayName: string;
  portalName: string;
  portalAdapterKey: string;
  baseUrl: string;
  authType: string;
  mfaMode: string;
  status: string;
  adapterVersion: string | null;
  usernameMasked: string | null;
  hasCredential: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  readOnlyConfirmed: boolean;
  authorizedByClient: boolean;
  maxConcurrentSessions: number;
}

export const listPortalConnectionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }): Promise<PortalConnectionDTO[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("rate_loading_portal_connections")
      .select("*")
      .eq("client_tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      portalName: r.portal_name,
      portalAdapterKey: r.portal_adapter_key,
      baseUrl: r.base_url,
      authType: r.auth_type,
      mfaMode: r.mfa_mode,
      status: r.status,
      adapterVersion: r.adapter_version,
      usernameMasked: r.username_hint,
      hasCredential: !!r.credential_secret_ref,
      lastTestAt: r.last_connection_test_at,
      lastTestStatus: r.last_connection_test_status,
      lastErrorCode: r.last_error_code,
      consecutiveFailures: r.consecutive_failures,
      readOnlyConfirmed: r.read_only_confirmed,
      authorizedByClient: r.authorized_by_client,
      maxConcurrentSessions: r.max_concurrent_sessions,
    }));
  });

export const savePortalConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      tenantId: string;
      displayName: string;
      portalName: string;
      portalAdapterKey: string;
      baseUrl: string;
      authType: string;
      mfaMode: string;
      maxConcurrentSessions?: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);

    const adapter = getAdapter(data.portalAdapterKey);
    if (!adapter) throw new Error("Adaptador de portal não aprovado.");

    const allowed =
      adapter.allowedDomains.length > 0
        ? adapter.allowedDomains
        : [new URL(data.baseUrl).hostname];
    const decision = isUrlAllowed(data.baseUrl, allowed);
    if (!decision.allowed) {
      throw new Error(`Endereço do portal não permitido (${decision.reason}).`);
    }

    const payload = {
      client_tenant_id: data.tenantId,
      display_name: data.displayName,
      portal_name: data.portalName,
      portal_adapter_key: data.portalAdapterKey,
      base_url: data.baseUrl,
      auth_type: data.authType,
      mfa_mode: data.mfaMode,
      adapter_version: adapter.version,
      max_concurrent_sessions: Math.min(Math.max(data.maxConcurrentSessions ?? 1, 1), 4),
    };

    if (data.id) {
      const { error } = await supabase
        .from("rate_loading_portal_connections")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(supabase, {
        tenant_id: data.tenantId,
        target_user_id: userId,
        actor_user_id: userId,
        action: "PORTAL_CONNECTION_UPDATED",
        key: data.id,
      });
      return { id: data.id };
    }

    const { data: created, error } = await supabase
      .from("rate_loading_portal_connections")
      .insert({ ...payload, created_by: userId, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: "PORTAL_CONNECTION_CREATED",
      key: created.id,
    });
    return { id: created.id };
  });

/** Store or rotate the portal credential. The value is encrypted and never returned. */
export const setPortalCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      connectionId: string;
      tenantId: string;
      username: string;
      password: string;
      readOnlyConfirmed: boolean;
      authorizationConfirmed: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    if (!data.readOnlyConfirmed || !data.authorizationConfirmed) {
      throw new Error("As duas confirmações obrigatórias precisam ser aceitas.");
    }
    if (!data.username.trim() || !data.password) {
      throw new Error("Usuário e senha são obrigatórios.");
    }

    const { encryptCredential, maskUsername } = await import("@/lib/rateLoading/credentialCrypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ciphertext = encryptCredential({ username: data.username.trim(), password: data.password });

    const { data: existing } = await supabaseAdmin
      .from("rate_loading_portal_credentials")
      .select("secret_ref")
      .eq("connection_id", data.connectionId)
      .maybeSingle();

    let secretRef: string;
    if (existing?.secret_ref) {
      secretRef = existing.secret_ref;
      const { error } = await supabaseAdmin
        .from("rate_loading_portal_credentials")
        .update({ ciphertext, rotated_at: new Date().toISOString(), rotated_by: userId })
        .eq("secret_ref", secretRef);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("rate_loading_portal_credentials")
        .insert({
          connection_id: data.connectionId,
          client_tenant_id: data.tenantId,
          ciphertext,
          rotated_by: userId,
        })
        .select("secret_ref")
        .single();
      if (error) throw new Error(error.message);
      secretRef = created.secret_ref;
    }

    const { error: updErr } = await supabase
      .from("rate_loading_portal_connections")
      .update({
        credential_secret_ref: secretRef,
        username_hint: maskUsername(data.username.trim()),
        read_only_confirmed: true,
        authorized_by_client: true,
        authorization_confirmed_at: new Date().toISOString(),
        authorization_confirmed_by: userId,
        status: "configured",
      })
      .eq("id", data.connectionId);
    if (updErr) throw new Error(updErr.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: existing ? "PORTAL_CREDENTIAL_ROTATED" : "PORTAL_CREDENTIAL_SET",
      key: data.connectionId,
    });

    return { ok: true };
  });

export const disablePortalConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { connectionId: string; tenantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    const { error } = await supabase
      .from("rate_loading_portal_connections")
      .update({ status: "disabled", disabled_at: new Date().toISOString() })
      .eq("id", data.connectionId);
    if (error) throw new Error(error.message);
    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: "PORTAL_CONNECTION_DISABLED",
      key: data.connectionId,
    });
    return { ok: true };
  });

/** Queue a login-only connection test for the worker to execute. */
export const requestConnectionTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { connectionId: string; tenantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    const { data: conn, error } = await supabase
      .from("rate_loading_portal_connections")
      .select("credential_secret_ref, status")
      .eq("id", data.connectionId)
      .single();
    if (error) throw new Error(error.message);
    if (!conn.credential_secret_ref) throw new Error("Configure a credencial antes de testar a conexão.");

    const { error: updErr } = await supabase
      .from("rate_loading_portal_connections")
      .update({
        last_connection_test_status: "PENDING",
        last_connection_test_at: new Date().toISOString(),
      })
      .eq("id", data.connectionId);
    if (updErr) throw new Error(updErr.message);
    return { status: "PENDING" as const };
  });

// ------------------------------------------------------------ eligibility

export interface EligibleHotelDTO {
  awardedProgramId: string;
  hotelName: string;
  city: string;
  tier: string;
  status: string;
  roomNights: number;
  finalAdr: number;
  spend: number;
  termsId: string | null;
  eligible: boolean;
  reasons: string[];
}

export const listEligibleHotelsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }): Promise<EligibleHotelDTO[]> => {
    const { supabase } = context;
    const [awardedRes, termsRes] = await Promise.all([
      supabase.from("awarded_program").select("*").eq("client_tenant_id", data.tenantId),
      supabase.from("final_agreed_terms").select("*").eq("client_tenant_id", data.tenantId),
    ]);
    if (awardedRes.error) throw new Error(awardedRes.error.message);
    const terms = termsRes.data ?? [];
    const byAwarded = new Map(terms.filter((t) => t.awarded_program_id).map((t) => [t.awarded_program_id!, t]));

    return (awardedRes.data ?? []).map((a) => {
      const t = byAwarded.get(a.id);
      const reasons: string[] = [];
      if (!t) reasons.push("missing_accepted_rate");
      else {
        if (!t.currency) reasons.push("missing_currency");
        if (t.single_rate === null && t.double_rate === null) reasons.push("missing_accepted_rate");
        if (!t.valid_from || !t.valid_to) reasons.push("missing_validity");
        if (!t.rate_basis) reasons.push("missing_rate_basis");
      }
      return {
        awardedProgramId: a.id,
        hotelName: a.hotel_name,
        city: a.city,
        tier: a.tier,
        status: a.status,
        roomNights: a.room_nights,
        finalAdr: Number(a.final_adr),
        spend: Number(a.final_adr) * a.room_nights,
        termsId: t?.id ?? null,
        eligible: reasons.length === 0,
        reasons,
      };
    });
  });

/** Create the final-agreed-terms record for awarded hotels that lack one. */
export const deriveFinalTermsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; awardedProgramIds?: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);

    let q = supabase.from("awarded_program").select("*").eq("client_tenant_id", data.tenantId);
    if (data.awardedProgramIds?.length) q = q.in("id", data.awardedProgramIds);
    const { data: awarded, error } = await q;
    if (error) throw new Error(error.message);

    const { data: existing } = await supabase
      .from("final_agreed_terms")
      .select("awarded_program_id")
      .eq("client_tenant_id", data.tenantId);
    const have = new Set((existing ?? []).map((r) => r.awarded_program_id));

    const rows = (awarded ?? [])
      .filter((a) => !have.has(a.id))
      .map((a) => ({
        client_tenant_id: data.tenantId,
        awarded_program_id: a.id,
        hotel_name: a.hotel_name,
        city: a.city,
        currency: "BRL",
        single_rate: Number(a.final_adr),
        rate_basis: "per_night",
        valid_from: a.contract_start,
        valid_to: a.contract_end,
        cancellation_hours: a.cancellation_hours,
        refundable: a.cancellation_hours > 0,
        breakfast: (a.amenities ?? []).includes("breakfast"),
        wifi: (a.amenities ?? []).includes("wifi"),
        parking: (a.amenities ?? []).includes("parking"),
        lra: (a.amenities ?? []).includes("lra"),
        mandatory_amenities: a.amenities ?? [],
        source: "derived_from_awarded_program",
        created_by: userId,
      }));

    if (rows.length === 0) return { created: 0 };
    const { error: insErr } = await supabase.from("final_agreed_terms").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { created: rows.length };
  });

export const updateFinalTermsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; tenantId: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    const allowed = [
      "currency",
      "single_rate",
      "double_rate",
      "rate_basis",
      "room_type",
      "rate_plan",
      "corporate_rate_code",
      "valid_from",
      "valid_to",
      "lra",
      "breakfast",
      "wifi",
      "parking",
      "taxes_included",
      "service_charge_pct",
      "cancellation_policy",
      "cancellation_hours",
      "refundable",
      "mandatory_amenities",
      "optional_amenities",
      "notes",
    ];
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) if (allowed.includes(k)) patch[k] = v;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("final_agreed_terms").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------- entitlement

export interface EntitlementDTO {
  usageMode: "disabled" | "limited" | "unlimited";
  enabled: boolean;
  quotaLimit: number | null;
  bonusUnits: number;
  quotaPeriod: string;
  periodKey: string;
  reserved: number;
  consumed: number;
  used: number;
  available: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  nextReset: string | null;
}

export const getEntitlementFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }): Promise<EntitlementDTO> => {
    const { supabase } = context;
    const { data: ent } = await supabase
      .from("feature_entitlements")
      .select("*")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .maybeSingle();

    const quotaPeriod = ent?.quota_period ?? "monthly";
    const periodKey = periodKeyFor(quotaPeriod);

    const { data: ledger } = await supabase
      .from("feature_usage_ledger")
      .select("usage_units, usage_status")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .eq("period_key", periodKey);

    let reserved = 0;
    let consumed = 0;
    for (const r of ledger ?? []) {
      if (r.usage_status === "reserved") reserved += r.usage_units;
      if (r.usage_status === "consumed") consumed += r.usage_units;
    }
    const used = reserved + consumed;
    const mode = (ent?.usage_mode ?? "disabled") as EntitlementDTO["usageMode"];
    const limit = ent?.quota_limit ?? null;
    const bonus = ent?.bonus_units ?? 0;

    const now = new Date();
    const nextReset =
      quotaPeriod === "monthly"
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
        : quotaPeriod === "annual"
          ? new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)).toISOString()
          : null;

    return {
      usageMode: mode,
      enabled: ent?.enabled ?? false,
      quotaLimit: limit,
      bonusUnits: bonus,
      quotaPeriod,
      periodKey,
      reserved,
      consumed,
      used,
      available: mode === "unlimited" ? Number.MAX_SAFE_INTEGER : Math.max((limit ?? 0) + bonus - used, 0),
      effectiveFrom: ent?.effective_from ?? null,
      effectiveUntil: ent?.effective_until ?? null,
      nextReset,
    };
  });

export const setEntitlementFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      tenantId: string;
      enabled: boolean;
      usageMode: "disabled" | "limited" | "unlimited";
      quotaLimit: number | null;
      quotaPeriod: "monthly" | "annual" | "contract";
      bonusUnits: number;
      effectiveFrom: string | null;
      effectiveUntil: string | null;
      internalNote: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTaMaster(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feature_entitlements").upsert(
      {
        client_tenant_id: data.tenantId,
        feature_key: RATE_LOADING_FEATURE_KEY,
        enabled: data.enabled,
        usage_mode: data.usageMode,
        quota_limit: data.quotaLimit,
        quota_period: data.quotaPeriod,
        bonus_units: data.bonusUnits,
        effective_from: data.effectiveFrom,
        effective_until: data.effectiveUntil,
        internal_note: data.internalNote,
        configured_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_tenant_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: "RATE_LOADING_ENTITLEMENT_CHANGED",
      key: `${data.usageMode}:${data.quotaLimit ?? "-"}`,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------- campaigns

export interface CreateCampaignInput {
  tenantId: string;
  name: string;
  description?: string;
  rfpId?: string | null;
  portalConnectionId: string;
  awardedProgramIds: string[];
  stays: { checkIn: string; checkOut: string }[];
  occupancies: { rooms: number; adults: number; children: number }[];
  rules: {
    toleranceAmount: number;
    tolerancePercent: number;
    matchRoomType: boolean;
    matchRatePlan: boolean;
    requireLra: boolean;
    requireTaxesIncluded: boolean;
    matchCancellation: boolean;
  };
  dryRun?: boolean;
}

export const previewCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateCampaignInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const checks = data.awardedProgramIds.length * data.stays.length * data.occupancies.length;
    const { data: ent } = await supabase
      .from("feature_entitlements")
      .select("usage_mode, quota_limit, bonus_units, quota_period, enabled")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .maybeSingle();
    const periodKey = periodKeyFor(ent?.quota_period ?? "monthly");
    const { data: ledger } = await supabase
      .from("feature_usage_ledger")
      .select("usage_units")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .eq("period_key", periodKey)
      .in("usage_status", ["reserved", "consumed"]);
    const used = (ledger ?? []).reduce((s, r) => s + r.usage_units, 0);
    const unlimited = ent?.usage_mode === "unlimited" && ent?.enabled;
    const available = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max((ent?.quota_limit ?? 0) + (ent?.bonus_units ?? 0) - used, 0);
    return { checks, available, unlimited, sufficient: unlimited || available >= checks };
  });

export const createCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateCampaignInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    if (data.awardedProgramIds.length === 0) throw new Error("Selecione pelo menos um hotel.");
    if (data.stays.length === 0) throw new Error("Selecione pelo menos uma estadia.");
    if (data.occupancies.length === 0) throw new Error("Defina pelo menos uma ocupação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load eligible hotels + terms
    const [awardedRes, termsRes, connRes] = await Promise.all([
      supabase.from("awarded_program").select("*").in("id", data.awardedProgramIds),
      supabase.from("final_agreed_terms").select("*").eq("client_tenant_id", data.tenantId),
      supabase
        .from("rate_loading_portal_connections")
        .select("id, status, credential_secret_ref, portal_adapter_key")
        .eq("id", data.portalConnectionId)
        .single(),
    ]);
    if (awardedRes.error) throw new Error(awardedRes.error.message);
    if (connRes.error) throw new Error(connRes.error.message);
    if (!connRes.data.credential_secret_ref) throw new Error("A conexão de portal não possui credencial.");

    const termsByAwarded = new Map(
      (termsRes.data ?? []).filter((t) => t.awarded_program_id).map((t) => [t.awarded_program_id!, t]),
    );

    const totalChecks = data.awardedProgramIds.length * data.stays.length * data.occupancies.length;

    // Reserve quota transactionally BEFORE creating jobs
    const { data: ent } = await supabaseAdmin
      .from("feature_entitlements")
      .select("quota_period")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .maybeSingle();
    const periodKey = periodKeyFor(ent?.quota_period ?? "monthly");

    const { data: campaign, error: campErr } = await supabase
      .from("rate_loading_campaigns")
      .insert({
        client_tenant_id: data.tenantId,
        name: data.name,
        description: data.description ?? null,
        rfp_id: data.rfpId ?? null,
        portal_connection_id: data.portalConnectionId,
        status: "draft",
        validation_rules: data.rules as unknown as Record<string, unknown>,
        created_by: userId,
      })
      .select("id")
      .single();
    if (campErr) throw new Error(campErr.message);

    const { data: reservation, error: resErr } = await supabaseAdmin.rpc("reserve_feature_quota", {
      _tenant_id: data.tenantId,
      _feature_key: RATE_LOADING_FEATURE_KEY,
      _units: totalChecks,
      _campaign_id: campaign.id,
      _period_key: periodKey,
    });
    if (resErr) throw new Error(resErr.message);
    const reserved = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!reserved?.allowed) {
      await supabase.from("rate_loading_campaigns").delete().eq("id", campaign.id);
      throw new Error(
        reserved?.reason === "quota_exceeded"
          ? `Franquia insuficiente: ${reserved.available} checks disponíveis, ${totalChecks} necessários.`
          : "Rate Loading não está habilitado para este cliente.",
      );
    }

    // Build checks with immutable expected snapshots
    const checkRows: Record<string, unknown>[] = [];
    for (const awarded of awardedRes.data ?? []) {
      const t = termsByAwarded.get(awarded.id);
      if (!t) continue;
      for (const stay of data.stays) {
        const nights = nightsBetween(stay.checkIn, stay.checkOut);
        for (const occ of data.occupancies) {
          const snapshot: ExpectedRateSnapshot = {
            hotel_id: t.hotel_id,
            hotel_name: t.hotel_name,
            city: t.city,
            rfp_id: t.rfp_id,
            awarded_program_id: awarded.id,
            final_agreed_terms_id: t.id,
            currency: t.currency,
            rate_amount: t.single_rate === null ? null : Number(t.single_rate),
            rate_basis: (t.rate_basis as "per_night" | "total_stay") ?? "per_night",
            room_type: t.room_type,
            rate_plan: t.rate_plan,
            corporate_rate_code: t.corporate_rate_code,
            occupancy: occ,
            check_in: stay.checkIn,
            check_out: stay.checkOut,
            number_of_nights: nights,
            valid_from: t.valid_from,
            valid_to: t.valid_to,
            lra: t.lra,
            breakfast: t.breakfast,
            wifi: t.wifi,
            parking: t.parking,
            taxes_included: t.taxes_included,
            service_charge_pct: t.service_charge_pct === null ? null : Number(t.service_charge_pct),
            cancellation_policy: t.cancellation_policy,
            cancellation_hours: t.cancellation_hours,
            refundable: t.refundable,
            mandatory_amenities: t.mandatory_amenities ?? [],
            optional_amenities: t.optional_amenities ?? [],
            inclusions: (t.inclusions ?? {}) as Record<string, unknown>,
          };
          const hash = await snapshotHash(snapshot);
          checkRows.push({
            client_tenant_id: data.tenantId,
            campaign_id: campaign.id,
            awarded_program_id: awarded.id,
            final_agreed_terms_id: t.id,
            hotel_id: t.hotel_id,
            hotel_name: t.hotel_name,
            city: t.city,
            check_in: stay.checkIn,
            check_out: stay.checkOut,
            number_of_nights: nights,
            rooms: occ.rooms,
            adults: occ.adults,
            children: occ.children,
            expected_snapshot: snapshot as unknown as Record<string, unknown>,
            expected_snapshot_hash: hash,
            expected_rate_amount: snapshot.rate_amount,
            expected_currency: snapshot.currency,
            expected_rate_basis: snapshot.rate_basis,
            expected_room_type: snapshot.room_type,
            expected_rate_plan: snapshot.rate_plan,
            expected_rate_code: snapshot.corporate_rate_code,
            expected_lra: snapshot.lra,
            expected_refundable: snapshot.refundable,
            expected_breakfast: snapshot.breakfast,
            expected_wifi: snapshot.wifi,
            expected_parking: snapshot.parking,
            expected_taxes_included: snapshot.taxes_included,
            expected_cancellation_policy: snapshot.cancellation_policy,
            expected_amenities: {
              mandatory: snapshot.mandatory_amenities,
              optional: snapshot.optional_amenities,
            },
            rate_tolerance_amount: data.rules.toleranceAmount,
            rate_tolerance_percent: data.rules.tolerancePercent,
            status: "pending",
          });
        }
      }
    }

    if (checkRows.length === 0) {
      await supabase.from("rate_loading_campaigns").delete().eq("id", campaign.id);
      throw new Error("Nenhum hotel elegível: falta o acordo final registrado.");
    }

    const { data: createdChecks, error: chkErr } = await supabase
      .from("rate_loading_checks")
      .insert(checkRows)
      .select("id");
    if (chkErr) throw new Error(chkErr.message);

    const jobRows = (createdChecks ?? []).map((c) => ({
      client_tenant_id: data.tenantId,
      campaign_id: campaign.id,
      check_id: c.id,
      portal_connection_id: data.portalConnectionId,
      idempotency_key: `${campaign.id}:${c.id}:1`,
      status: "pending",
    }));
    const { error: jobErr } = await supabaseAdmin.from("rate_loading_jobs").insert(jobRows);
    if (jobErr) throw new Error(jobErr.message);

    await supabase
      .from("rate_loading_campaigns")
      .update({ status: "queued", started_at: new Date().toISOString() })
      .eq("id", campaign.id);

    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: "RATE_LOADING_CAMPAIGN_CREATED",
      key: campaign.id,
    });

    return { campaignId: campaign.id, checks: checkRows.length };
  });

export const listCampaignsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaigns, error } = await supabase
      .from("rate_loading_campaigns")
      .select("*")
      .eq("client_tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (campaigns ?? []).map((c) => c.id);
    const { data: checks } = ids.length
      ? await supabase
          .from("rate_loading_checks")
          .select("campaign_id, status, latest_result_code, last_checked_at")
          .in("campaign_id", ids)
      : { data: [] as { campaign_id: string; status: string; latest_result_code: string | null; last_checked_at: string | null }[] };

    return (campaigns ?? []).map((c) => {
      const own = (checks ?? []).filter((k) => k.campaign_id === c.id);
      const done = own.filter((k) => k.status === "completed").length;
      const count = (codes: string[]) => own.filter((k) => k.latest_result_code && codes.includes(k.latest_result_code)).length;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        rfpId: c.rfp_id,
        portalConnectionId: c.portal_connection_id,
        createdAt: c.created_at,
        startedAt: c.started_at,
        finishedAt: c.finished_at,
        totalChecks: own.length,
        completedChecks: done,
        passed: count(["PASS_EXACT", "PASS_WITH_TOLERANCE"]),
        mismatch: count([
          "LOADED_WITH_MISMATCH",
          "RATE_VALUE_MISMATCH",
          "CURRENCY_MISMATCH",
          "ROOM_TYPE_MISMATCH",
          "RATE_PLAN_MISMATCH",
          "AMENITY_MISMATCH",
          "BREAKFAST_MISMATCH",
          "TAX_MISMATCH",
          "CANCELLATION_MISMATCH",
          "LRA_MISMATCH",
        ]),
        notLoaded: count(["RATE_NOT_FOUND", "HOTEL_NOT_FOUND"]),
        review: count(["MANUAL_REVIEW", "NEEDS_HUMAN_ACTION"]),
        technicalErrors: count(["LOGIN_FAILED", "PORTAL_ERROR", "AUTOMATION_ERROR"]),
        lastRun: own.reduce<string | null>(
          (acc, k) => (k.last_checked_at && (!acc || k.last_checked_at > acc) ? k.last_checked_at : acc),
          null,
        ),
      };
    });
  });

export const getCampaignDetailFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("rate_loading_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (error) throw new Error(error.message);
    const { data: checks } = await supabase
      .from("rate_loading_checks")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .order("hotel_name");
    const checkIds = (checks ?? []).map((c) => c.id);
    const { data: attempts } = checkIds.length
      ? await supabase
          .from("rate_loading_attempts")
          .select("*")
          .in("check_id", checkIds)
          .order("attempt_number", { ascending: false })
      : { data: [] as Record<string, unknown>[] };
    return { campaign, checks: checks ?? [], attempts: attempts ?? [] };
  });

export const rerunChecksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; campaignId: string; checkIds?: string[]; failuresOnly?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTenantVisible(supabase, userId, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabase.from("rate_loading_checks").select("id, latest_result_code").eq("campaign_id", data.campaignId);
    if (data.checkIds?.length) q = q.in("id", data.checkIds);
    const { data: checks, error } = await q;
    if (error) throw new Error(error.message);

    const failureCodes = new Set([
      "RATE_NOT_FOUND",
      "HOTEL_NOT_FOUND",
      "RATE_VALUE_MISMATCH",
      "CURRENCY_MISMATCH",
      "ROOM_TYPE_MISMATCH",
      "RATE_PLAN_MISMATCH",
      "AMENITY_MISMATCH",
      "BREAKFAST_MISMATCH",
      "TAX_MISMATCH",
      "CANCELLATION_MISMATCH",
      "LRA_MISMATCH",
      "LOADED_WITH_MISMATCH",
      "LOGIN_FAILED",
      "PORTAL_ERROR",
      "AUTOMATION_ERROR",
      "MANUAL_REVIEW",
      "NEEDS_HUMAN_ACTION",
    ]);
    const target = (checks ?? []).filter((c) =>
      data.failuresOnly ? c.latest_result_code && failureCodes.has(c.latest_result_code) : true,
    );
    if (target.length === 0) return { queued: 0 };

    // Rerun requested by the user = new billable usage.
    const { data: ent } = await supabaseAdmin
      .from("feature_entitlements")
      .select("quota_period")
      .eq("client_tenant_id", data.tenantId)
      .eq("feature_key", RATE_LOADING_FEATURE_KEY)
      .maybeSingle();
    const periodKey = periodKeyFor(ent?.quota_period ?? "monthly");
    const { data: reservation } = await supabaseAdmin.rpc("reserve_feature_quota", {
      _tenant_id: data.tenantId,
      _feature_key: RATE_LOADING_FEATURE_KEY,
      _units: target.length,
      _campaign_id: data.campaignId,
      _period_key: periodKey,
    });
    const reserved = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!reserved?.allowed) {
      throw new Error(`Franquia insuficiente para reexecutar ${target.length} checks.`);
    }

    const { data: existingJobs } = await supabaseAdmin
      .from("rate_loading_jobs")
      .select("check_id")
      .in("check_id", target.map((c) => c.id));
    const runIndex = new Map<string, number>();
    for (const j of existingJobs ?? []) runIndex.set(j.check_id, (runIndex.get(j.check_id) ?? 0) + 1);

    const { data: campaign } = await supabase
      .from("rate_loading_campaigns")
      .select("portal_connection_id")
      .eq("id", data.campaignId)
      .single();

    const rows = target.map((c) => ({
      client_tenant_id: data.tenantId,
      campaign_id: data.campaignId,
      check_id: c.id,
      portal_connection_id: campaign?.portal_connection_id ?? null,
      idempotency_key: `${data.campaignId}:${c.id}:${(runIndex.get(c.id) ?? 0) + 1}`,
      status: "pending",
    }));
    const { error: jobErr } = await supabaseAdmin.from("rate_loading_jobs").insert(rows);
    if (jobErr) throw new Error(jobErr.message);

    await supabase
      .from("rate_loading_checks")
      .update({ status: "pending" })
      .in("id", target.map((c) => c.id));
    await supabase.from("rate_loading_campaigns").update({ status: "queued" }).eq("id", data.campaignId);

    await audit(supabase, {
      tenant_id: data.tenantId,
      target_user_id: userId,
      actor_user_id: userId,
      action: "RATE_LOADING_RERUN_REQUESTED",
      key: `${data.campaignId}:${target.length}`,
    });

    return { queued: rows.length };
  });

// ---------------------------------------------------------------- overview

export const getRateLoadingOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [checksRes, connRes, evidenceRes] = await Promise.all([
      supabase
        .from("rate_loading_checks")
        .select("id, hotel_name, status, latest_result_code, last_checked_at")
        .eq("client_tenant_id", data.tenantId),
      supabase
        .from("rate_loading_portal_connections")
        .select("id, status")
        .eq("client_tenant_id", data.tenantId),
      supabase
        .from("rate_loading_evidence")
        .select("id", { count: "exact", head: true })
        .eq("client_tenant_id", data.tenantId),
    ]);

    const checks = checksRes.data ?? [];
    const codes = checks.map((c) => c.latest_result_code);
    const { computeCompliance } = await import("@/lib/rateLoading/comparator");
    const { compliance, businessChecks, passes } = computeCompliance(codes);
    const count = (list: string[]) => codes.filter((c) => c && list.includes(c)).length;

    return {
      totalChecks: checks.length,
      hotelsChecked: new Set(checks.filter((c) => c.last_checked_at).map((c) => c.hotel_name)).size,
      completedBusinessChecks: businessChecks,
      loadedCorrectly: passes,
      loadedWithMismatch: count([
        "LOADED_WITH_MISMATCH",
        "RATE_VALUE_MISMATCH",
        "CURRENCY_MISMATCH",
        "ROOM_TYPE_MISMATCH",
        "RATE_PLAN_MISMATCH",
        "AMENITY_MISMATCH",
        "BREAKFAST_MISMATCH",
        "TAX_MISMATCH",
        "CANCELLATION_MISMATCH",
        "LRA_MISMATCH",
      ]),
      notLoaded: count(["RATE_NOT_FOUND", "HOTEL_NOT_FOUND"]),
      needsReview: count(["MANUAL_REVIEW", "NEEDS_HUMAN_ACTION"]),
      portalErrors: count(["LOGIN_FAILED", "PORTAL_ERROR", "AUTOMATION_ERROR"]),
      compliance,
      lastExecution: checks.reduce<string | null>(
        (acc, c) => (c.last_checked_at && (!acc || c.last_checked_at > acc) ? c.last_checked_at : acc),
        null,
      ),
      connections: (connRes.data ?? []).length,
      verifiedConnections: (connRes.data ?? []).filter((c) => c.status === "verified").length,
      evidenceCount: evidenceRes.count ?? 0,
    };
  });

/** Latest Rate Loading status per awarded hotel — consumed by the Hotel Directory. */
export const getDirectoryRateLoadingStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("rate_loading_checks")
      .select("awarded_program_id, latest_result_code, last_checked_at")
      .eq("client_tenant_id", data.tenantId)
      .not("last_checked_at", "is", null)
      .order("last_checked_at", { ascending: false });
    const out: Record<string, { resultCode: string | null; lastCheckedAt: string | null }> = {};
    for (const r of rows ?? []) {
      if (!r.awarded_program_id || out[r.awarded_program_id]) continue;
      out[r.awarded_program_id] = { resultCode: r.latest_result_code, lastCheckedAt: r.last_checked_at };
    }
    return out;
  });

/** Short-lived signed URL for a stored evidence file. */
export const getEvidenceUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { evidenceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ev, error } = await supabase
      .from("rate_loading_evidence")
      .select("storage_path, client_tenant_id")
      .eq("id", data.evidenceId)
      .single();
    if (error) throw new Error("Evidência não encontrada ou sem acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("rate-loading-evidence")
      .createSignedUrl(ev.storage_path, 300);
    if (signErr) throw new Error(signErr.message);
    return { url: signed.signedUrl };
  });
