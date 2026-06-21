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

export const setUserModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setModuleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_module_overrides")
      .upsert(
        { user_id: data.userId, tenant_id: data.tenantId, module_key: data.moduleKey, enabled: data.enabled },
        { onConflict: "user_id,tenant_id,module_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserFeatureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setFeatureSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_feature_overrides")
      .upsert(
        { user_id: data.userId, tenant_id: data.tenantId, feature_key: data.featureKey, enabled: data.enabled },
        { onConflict: "user_id,tenant_id,feature_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserOverridesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    return { ok: true };
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
