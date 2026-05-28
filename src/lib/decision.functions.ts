import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit, getClientIp } from "./rate-limit.server";

// ============================================================================
// Schemas
// ============================================================================

const alertTypeSchema = z.enum([
  "ADR_VARIANCE",
  "SMART_LEAKAGE",
  "RATE_LOADING",
  "HOTEL_UNDERPERFORMANCE",
  "HOTEL_DEPENDENCY",
  "SAVINGS_MISSED",
]);
const severitySchema = z.enum(["high", "medium", "low"]);
const alertStatusSchema = z.enum(["open", "in_progress", "dismissed", "completed"]);

const actionTypeSchema = z.enum([
  "SEND_ALERT",
  "FOLLOW_UP",
  "IGNORE",
  "OPEN_MINI_RFP",
  "ADD_TO_PIPELINE",
]);
const actionStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "WAITING_RESPONSE",
  "RESPONDED",
  "COMPLETED",
  "IGNORED",
]);

const followupKindSchema = z.enum(["email", "call", "meeting", "note"]);
const followupOutcomeSchema = z.enum(["pending", "done", "no_response", "cancelled"]);

// Generic untyped Supabase client — new tables aren't in types.ts yet.
type AnySupabase = {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: "exact" }) => unknown;
    insert: (row: unknown) => unknown;
    update: (patch: unknown) => unknown;
    upsert: (rows: unknown, opts?: { onConflict?: string }) => unknown;
    delete: () => unknown;
  };
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string) => Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: { message: string } | null }>;
    };
  };
};

const asAny = (s: unknown) => s as AnySupabase;

// ============================================================================
// Alerts
// ============================================================================

const alertInputSchema = z.object({
  signature: z.string().min(1).max(200),
  type: alertTypeSchema,
  severity: severitySchema,
  title: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  impactedCity: z.string().max(120).nullable().optional(),
  impactedHotel: z.string().max(200).nullable().optional(),
  financialImpact: z.number().finite().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const upsertAlertsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        alerts: z.array(alertInputSchema).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    if (data.alerts.length === 0) return { ok: true, upserted: 0 };
    const rows = data.alerts.map((a) => ({
      client_tenant_id: data.clientTenantId,
      signature: a.signature,
      type: a.type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      impacted_city: a.impactedCity ?? null,
      impacted_hotel: a.impactedHotel ?? null,
      financial_impact: a.financialImpact,
      metadata: a.metadata,
    }));
    const q = supabase
      .from("decision_alerts")
      .upsert(rows, { onConflict: "client_tenant_id,signature" }) as unknown as {
        select: (c: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      };
    const { data: out, error } = await q.select("*");
    if (error) throw new Error(error.message);
    return { ok: true, upserted: out?.length ?? 0, rows: (out ?? []) as Record<string, unknown>[] };
  });

export const listAlertsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        status: alertStatusSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    let q = supabase.from("decision_alerts").select("*") as unknown as {
      eq: (c: string, v: unknown) => typeof q;
      order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
    q = q.eq("client_tenant_id", data.clientTenantId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });

export const setAlertStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ alertId: z.string().uuid(), status: alertStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "dismissed") patch.dismissed_at = new Date().toISOString();
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    const q = supabase.from("decision_alerts").update(patch) as unknown as {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await q.eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Actions
// ============================================================================

export const createDecisionActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        alertId: z.string().uuid().nullable().optional(),
        type: actionTypeSchema,
        status: actionStatusSchema.optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        emailRecipients: z.array(z.string().email()).max(20).optional(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const userId = context.userId;
    await enforceRateLimit({
      bucket: "decision_action_create",
      key: `${data.clientTenantId}:${userId}:${getClientIp() ?? "noip"}`,
      max: 30,
      windowSeconds: 60,
    });
    const row = {
      client_tenant_id: data.clientTenantId,
      alert_id: data.alertId ?? null,
      type: data.type,
      status: data.status ?? "PENDING",
      assigned_to: data.assignedTo ?? null,
      email_recipients: data.emailRecipients ?? null,
      payload: data.payload,
      created_by: userId,
    };
    const q = supabase.from("decision_actions").insert(row) as unknown as {
      select: (c: string) => { single: () => Promise<{ data: Record<string, unknown>; error: { message: string } | null }> };
    };
    const { data: out, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return out as Record<string, unknown>;
  });

export const setActionStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ actionId: z.string().uuid(), status: actionStatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "COMPLETED" || data.status === "IGNORED") {
      patch.completed_at = new Date().toISOString();
    }
    const q = supabase.from("decision_actions").update(patch) as unknown as {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await q.eq("id", data.actionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listActionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        status: actionStatusSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    let q = supabase.from("decision_actions").select("*") as unknown as {
      eq: (c: string, v: unknown) => typeof q;
      order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
    q = q.eq("client_tenant_id", data.clientTenantId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });

// ============================================================================
// Watchlist
// ============================================================================

export const listWatchlistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        pinnedOnly: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    let q = supabase.from("decision_watchlist").select("*") as unknown as {
      eq: (c: string, v: unknown) => typeof q;
      order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
    q = q.eq("client_tenant_id", data.clientTenantId);
    if (data.pinnedOnly) q = q.eq("pinned", true);
    const { data: rows, error } = await q.order("last_activity_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });

export const setWatchlistPinnedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().uuid(), pinned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const q = supabase.from("decision_watchlist").update({ pinned: data.pinned }) as unknown as {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await q.eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Follow-ups
// ============================================================================

export const addFollowUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        actionId: z.string().uuid(),
        kind: followupKindSchema,
        scheduledAt: z.string().datetime().nullable().optional(),
        notes: z.string().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const row = {
      client_tenant_id: data.clientTenantId,
      action_id: data.actionId,
      kind: data.kind,
      scheduled_at: data.scheduledAt ?? null,
      notes: data.notes,
      created_by: context.userId,
    };
    const q = supabase.from("decision_followups").insert(row) as unknown as {
      select: (c: string) => { single: () => Promise<{ data: Record<string, unknown>; error: { message: string } | null }> };
    };
    const { data: out, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return out as Record<string, unknown>;
  });

export const completeFollowUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        followUpId: z.string().uuid(),
        outcome: followupOutcomeSchema,
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const patch: Record<string, unknown> = {
      outcome: data.outcome,
      executed_at: new Date().toISOString(),
    };
    if (data.notes !== undefined) patch.notes = data.notes;
    const q = supabase.from("decision_followups").update(patch) as unknown as {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await q.eq("id", data.followUpId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFollowUpsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ actionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const q = supabase.from("decision_followups").select("*") as unknown as {
      eq: (c: string, v: unknown) => {
        order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      };
    };
    const { data: rows, error } = await q.eq("action_id", data.actionId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });

// ============================================================================
// Comments
// ============================================================================

export const addCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        actionId: z.string().uuid().nullable().optional(),
        alertId: z.string().uuid().nullable().optional(),
        body: z.string().min(1).max(5000),
      })
      .refine((v) => v.actionId || v.alertId, { message: "actionId or alertId required" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const userId = context.userId;
    await enforceRateLimit({
      bucket: "decision_comment",
      key: `${userId}:${getClientIp() ?? "noip"}`,
      max: 60,
      windowSeconds: 60,
    });
    const row = {
      client_tenant_id: data.clientTenantId,
      action_id: data.actionId ?? null,
      alert_id: data.alertId ?? null,
      body: data.body,
      author_id: userId,
    };
    const q = supabase.from("decision_comments").insert(row) as unknown as {
      select: (c: string) => { single: () => Promise<{ data: Record<string, unknown>; error: { message: string } | null }> };
    };
    const { data: out, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return out as Record<string, unknown>;
  });

export const listCommentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        actionId: z.string().uuid().optional(),
        alertId: z.string().uuid().optional(),
      })
      .refine((v) => v.actionId || v.alertId, { message: "actionId or alertId required" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const q = supabase.from("decision_comments").select("*") as unknown as {
      eq: (c: string, v: unknown) => {
        order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      };
    };
    const filterCol = data.actionId ? "action_id" : "alert_id";
    const filterVal = data.actionId ?? data.alertId;
    const { data: rows, error } = await q.eq(filterCol, filterVal).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });

// ============================================================================
// Attachments (signed upload URL → record metadata after browser upload)
// ============================================================================

export const createAttachmentUploadUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        actionId: z.string().uuid(),
        filename: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = crypto.randomUUID();
    const path = `decision/${data.clientTenantId}/${data.actionId}/${fileId}-${safeName}`;
    const { data: signed, error } = await supabase.storage
      .from("baseline-files")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Failed to sign upload URL");
    return { signedUrl: signed.signedUrl, token: signed.token, path: signed.path };
  });

export const recordAttachmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientTenantId: z.string().uuid(),
        actionId: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
        filename: z.string().min(1).max(255),
        mimeType: z.string().max(120).optional(),
        sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const row = {
      client_tenant_id: data.clientTenantId,
      action_id: data.actionId,
      storage_path: data.storagePath,
      filename: data.filename,
      mime_type: data.mimeType ?? null,
      size_bytes: data.sizeBytes,
      uploaded_by: context.userId,
    };
    const q = supabase.from("decision_attachments").insert(row) as unknown as {
      select: (c: string) => { single: () => Promise<{ data: Record<string, unknown>; error: { message: string } | null }> };
    };
    const { data: out, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return out as Record<string, unknown>;
  });

export const listAttachmentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ actionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = asAny(context.supabase);
    const q = supabase.from("decision_attachments").select("*") as unknown as {
      eq: (c: string, v: unknown) => {
        order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      };
    };
    const { data: rows, error } = await q.eq("action_id", data.actionId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Record<string, unknown>[];
  });
