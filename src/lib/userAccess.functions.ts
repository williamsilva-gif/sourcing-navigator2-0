import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tenantUserSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
});

const setModuleSchema = tenantUserSchema.extend({
  moduleKey: z.string().min(1),
  enabled: z.boolean(),
});

const setFeatureSchema = tenantUserSchema.extend({
  featureKey: z.string().min(1),
  enabled: z.boolean(),
});

async function assertCanManage(context: { supabase: any; userId: string }, tenantId: string) {
  const { data: isTa } = await context.supabase.rpc("is_ta_master", { _user_id: context.userId });
  if (isTa) return;
  // Tenant admin check
  const { data: rows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("tenant_id", tenantId);
  const ok = (rows ?? []).some((r: { role: string }) =>
    ["tmc_admin", "corp_admin", "hotel_admin"].includes(r.role),
  );
  if (!ok) throw new Error("Sem permissão para gerenciar este cliente.");
}

/** Read all overrides for a user inside a tenant. */
export const getUserOverridesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [modules, features] = await Promise.all([
      supabaseAdmin
        .from("user_module_overrides")
        .select("module_key, enabled")
        .eq("user_id", data.userId)
        .eq("tenant_id", data.tenantId),
      supabaseAdmin
        .from("user_feature_overrides")
        .select("feature_key, enabled")
        .eq("user_id", data.userId)
        .eq("tenant_id", data.tenantId),
    ]);
    return {
      modules: (modules.data ?? []) as Array<{ module_key: string; enabled: boolean }>,
      features: (features.data ?? []) as Array<{ feature_key: string; enabled: boolean }>,
    };
  });

async function readPrevModule(admin: any, userId: string, tenantId: string, key: string) {
  const { data } = await admin
    .from("user_module_overrides")
    .select("enabled")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("module_key", key)
    .maybeSingle();
  return (data?.enabled as boolean | undefined) ?? null;
}

async function readPrevFeature(admin: any, userId: string, tenantId: string, key: string) {
  const { data } = await admin
    .from("user_feature_overrides")
    .select("enabled")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("feature_key", key)
    .maybeSingle();
  return (data?.enabled as boolean | undefined) ?? null;
}

async function audit(
  admin: any,
  entry: {
    tenant_id: string;
    target_user_id: string;
    actor_user_id: string;
    kind: "module" | "feature";
    key: string;
    action: "set" | "reset";
    previous_value: boolean | null;
    new_value: boolean | null;
  },
) {
  await admin.from("access_audit_log").insert(entry);
}

export const setUserModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setModuleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prev = await readPrevModule(supabaseAdmin, data.userId, data.tenantId, data.moduleKey);
    const { error } = await supabaseAdmin
      .from("user_module_overrides")
      .upsert(
        { user_id: data.userId, tenant_id: data.tenantId, module_key: data.moduleKey, enabled: data.enabled },
        { onConflict: "user_id,tenant_id,module_key" },
      );
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, {
      tenant_id: data.tenantId,
      target_user_id: data.userId,
      actor_user_id: context.userId,
      kind: "module",
      key: data.moduleKey,
      action: "set",
      previous_value: prev,
      new_value: data.enabled,
    });
    return { ok: true };
  });

export const setUserFeatureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setFeatureSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prev = await readPrevFeature(supabaseAdmin, data.userId, data.tenantId, data.featureKey);
    const { error } = await supabaseAdmin
      .from("user_feature_overrides")
      .upsert(
        { user_id: data.userId, tenant_id: data.tenantId, feature_key: data.featureKey, enabled: data.enabled },
        { onConflict: "user_id,tenant_id,feature_key" },
      );
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, {
      tenant_id: data.tenantId,
      target_user_id: data.userId,
      actor_user_id: context.userId,
      kind: "feature",
      key: data.featureKey,
      action: "set",
      previous_value: prev,
      new_value: data.enabled,
    });
    return { ok: true };
  });

export const resetUserOverridesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mods, feats] = await Promise.all([
      supabaseAdmin
        .from("user_module_overrides")
        .select("module_key, enabled")
        .eq("user_id", data.userId)
        .eq("tenant_id", data.tenantId),
      supabaseAdmin
        .from("user_feature_overrides")
        .select("feature_key, enabled")
        .eq("user_id", data.userId)
        .eq("tenant_id", data.tenantId),
    ]);
    await supabaseAdmin
      .from("user_module_overrides")
      .delete()
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId);
    await supabaseAdmin
      .from("user_feature_overrides")
      .delete()
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId);
    const entries = [
      ...(mods.data ?? []).map((r: any) => ({
        tenant_id: data.tenantId,
        target_user_id: data.userId,
        actor_user_id: context.userId,
        kind: "module" as const,
        key: r.module_key,
        action: "reset" as const,
        previous_value: r.enabled,
        new_value: null,
      })),
      ...(feats.data ?? []).map((r: any) => ({
        tenant_id: data.tenantId,
        target_user_id: data.userId,
        actor_user_id: context.userId,
        kind: "feature" as const,
        key: r.feature_key,
        action: "reset" as const,
        previous_value: r.enabled,
        new_value: null,
      })),
    ];
    if (entries.length) await supabaseAdmin.from("access_audit_log").insert(entries);
    return { ok: true, reset: entries.length };
  });

/** Bulk reset: wipes overrides for every user in a tenant. */
export const resetAllTenantOverridesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc(
      "reset_all_user_overrides_for_tenant",
      { _tenant_id: data.tenantId, _actor: context.userId },
    );
    if (error) throw new Error(error.message);
    return { ok: true, reset: (count as number) ?? 0 };
  });

/** Returns the effective module/feature access for the current signed-in user
 *  inside one of their tenants. Used by the sidebar/route guards. */
export const getMyEffectiveAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("effective_user_access", {
      _user_id: context.userId,
      _tenant_id: data.tenantId,
    });
    if (error) throw new Error(error.message);
    const modules: Record<string, boolean> = {};
    const features: Record<string, boolean> = {};
    for (const r of (rows ?? []) as Array<{ kind: string; key: string; enabled: boolean }>) {
      if (r.kind === "module") modules[r.key] = r.enabled;
      else if (r.kind === "feature") features[r.key] = r.enabled;
    }
    return { modules, features };
  });

/** Recent audit entries for a tenant. */
export const listAccessAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tenantId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_audit_log")
      .select("id, target_user_id, actor_user_id, kind, key, action, previous_value, new_value, created_at")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const userIds = Array.from(
      new Set((rows ?? []).flatMap((r) => [r.target_user_id, r.actor_user_id].filter(Boolean) as string[])),
    );
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] as Array<{ id: string; email: string; full_name: string }> };
    const nameOf = (id: string | null) => {
      if (!id) return "—";
      const p = profs?.find((x) => x.id === id);
      return p?.full_name || p?.email || id.slice(0, 8);
    };
    return (rows ?? []).map((r) => ({
      ...r,
      target_name: nameOf(r.target_user_id),
      actor_name: nameOf(r.actor_user_id),
    }));
  });

