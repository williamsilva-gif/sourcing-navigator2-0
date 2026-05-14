import { supabase } from "@/integrations/supabase/client";

// Map UI ClientType (TMC/Corporate/Supplier) ↔ DB tenant_type (TA/TMC/CORP/HOTEL)
export type ClientType = "TMC" | "Corporate" | "Supplier";
export type TenantType = "TA" | "TMC" | "CORP" | "HOTEL";

export function clientTypeToTenantType(t: ClientType): TenantType {
  if (t === "TMC") return "TMC";
  if (t === "Corporate") return "CORP";
  return "HOTEL"; // Supplier maps to HOTEL — closest semantic equivalent
}

export function tenantTypeToClientType(t: TenantType): ClientType {
  if (t === "TMC") return "TMC";
  if (t === "CORP") return "Corporate";
  if (t === "HOTEL") return "Supplier";
  return "Corporate"; // TA shouldn't appear in client picker; default fallback
}

export interface TenantRow {
  id: string;
  type: TenantType;
  name: string;
  parent_tenant_id: string | null;
  billing_status: string;
  created_at: string;
  updated_at: string;
}

export async function listVisibleTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, type, name, parent_tenant_id, billing_status, created_at, updated_at")
    .neq("type", "TA") // Hide TA tenant from the client picker
    .order("name", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

export async function createTenant(args: {
  name: string;
  type: TenantType;
  parent_tenant_id?: string | null;
}): Promise<TenantRow> {
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: args.name,
      type: args.type,
      parent_tenant_id: args.parent_tenant_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TenantRow;
}

export async function updateTenant(id: string, patch: { name?: string; type?: TenantType }): Promise<TenantRow> {
  const { data, error } = await supabase
    .from("tenants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TenantRow;
}

// There's no DELETE policy on tenants — we soft-delete by toggling billing_status.
export async function archiveTenant(id: string): Promise<void> {
  const { error } = await supabase.from("tenants").update({ billing_status: "archived" }).eq("id", id);
  if (error) throw error;
}

// Bulk migration: takes UI-shaped clients and inserts any name+type pair that
// doesn't already exist. Returns counts so the UI can confirm.
export async function migrateLocalClients(
  locals: { name: string; type: ClientType }[],
): Promise<{ added: number; skipped: number; failed: number; firstError?: string }> {
  if (locals.length === 0) return { added: 0, skipped: 0, failed: 0 };

  const existing = await listVisibleTenants();
  const existingKey = new Set(existing.map((t) => `${t.name.toLowerCase()}::${t.type}`));

  let added = 0;
  let skipped = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const c of locals) {
    const tenantType = clientTypeToTenantType(c.type);
    const key = `${c.name.toLowerCase()}::${tenantType}`;
    if (existingKey.has(key)) {
      skipped++;
      continue;
    }
    try {
      await createTenant({ name: c.name, type: tenantType });
      added++;
    } catch (e) {
      failed++;
      firstError ??= (e as Error).message;
    }
  }

  return { added, skipped, failed, firstError };
}
