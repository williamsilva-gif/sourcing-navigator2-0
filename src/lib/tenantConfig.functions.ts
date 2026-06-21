import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TenantConfigDTO {
  environment: "TMC" | "Corporate" | "Supplier";
  defaultCap: number;
  modules: Record<string, boolean>;
  features: Record<string, boolean>;
  thresholds: Record<string, number>;
}

export const getTenantConfigFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data, context }): Promise<TenantConfigDTO> => {
    const { supabase } = context;
    type TenantRow = { environment: string | null; default_cap: number | string | null };
    const [tenantRes, modulesRes, featuresRes, thresholdsRes] = await Promise.all([
      supabase
        .from("tenants")
        .select("environment, default_cap" as unknown as "id")
        .eq("id", data.tenantId)
        .maybeSingle(),
      supabase.from("tenant_modules").select("module_key, enabled").eq("tenant_id", data.tenantId),
      supabase.from("tenant_features").select("feature_key, enabled").eq("tenant_id", data.tenantId),
      supabase.from("tenant_thresholds").select("key, value").eq("tenant_id", data.tenantId),
    ]);

    const tenant = (tenantRes.data ?? null) as TenantRow | null;
    const env = (tenant?.environment ?? "TMC") as "TMC" | "Corporate" | "Supplier";
    const cap = tenant?.default_cap == null ? 280 : Number(tenant.default_cap);

    const modules: Record<string, boolean> = {};
    for (const r of (modulesRes.data ?? []) as { module_key: string; enabled: boolean }[]) {
      modules[r.module_key] = r.enabled;
    }
    const features: Record<string, boolean> = {};
    for (const r of (featuresRes.data ?? []) as { feature_key: string; enabled: boolean }[]) {
      features[r.feature_key] = r.enabled;
    }
    const thresholds: Record<string, number> = {};
    for (const r of (thresholdsRes.data ?? []) as { key: string; value: number | string }[]) {
      thresholds[r.key] = Number(r.value);
    }

    return { environment: env, defaultCap: cap, modules, features, thresholds };
  });

export const setTenantModuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; key: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenant_modules")
      .upsert(
        { tenant_id: data.tenantId, module_key: data.key, enabled: data.enabled },
        { onConflict: "tenant_id,module_key" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const setTenantFeatureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; key: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenant_features")
      .upsert(
        { tenant_id: data.tenantId, feature_key: data.key, enabled: data.enabled },
        { onConflict: "tenant_id,feature_key" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const setTenantThresholdFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; key: string; value: number }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenant_thresholds")
      .upsert(
        { tenant_id: data.tenantId, key: data.key, value: data.value },
        { onConflict: "tenant_id,key" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const setTenantSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { tenantId: string; environment?: "TMC" | "Corporate" | "Supplier"; defaultCap?: number }) => d,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.environment !== undefined) patch.environment = data.environment;
    if (data.defaultCap !== undefined) patch.default_cap = data.defaultCap;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("tenants")
      .update(patch as never)
      .eq("id", data.tenantId);
    if (error) throw error;
    return { ok: true };
  });
