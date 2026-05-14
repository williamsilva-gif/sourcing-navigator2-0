/** Shared helpers for RLS integration tests. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe } from "vitest";

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
export const hasIntegrationEnv = Boolean(SUPABASE_URL && SERVICE_KEY && ANON_KEY);
export const describeIntegration = hasIntegrationEnv ? describe : describe.skip;

const clientUrl = SUPABASE_URL || "http://127.0.0.1:54321";
const serviceKey = SERVICE_KEY || "missing-service-role-key";
const anonKey = ANON_KEY || "missing-publishable-key";

export const PASSWORD = "Test!12345";
export const RUN_ID = Math.random().toString(36).slice(2, 8);

export const admin = createClient(clientUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type AccountType = "HOTEL" | "TMC" | "CORP" | "TA";

export interface CreatedUser {
  id: string;
  email: string;
}

export async function createUser(
  prefix: string,
  label: string,
  accountType: AccountType,
  bag: CreatedUser[],
): Promise<CreatedUser> {
  const email = `rlstest+${prefix}-${RUN_ID}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `RLS ${label}`,
      account_type: accountType,
      org_name: `RLS Org ${prefix} ${label} ${RUN_ID}`,
    },
  });
  if (error || !data.user) throw error ?? new Error("user not created");
  const u = { id: data.user.id, email };
  bag.push(u);
  return u;
}

export function userClient(): SupabaseClient {
  return createClient(clientUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signIn(email: string): Promise<SupabaseClient> {
  const c = userClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

export async function cleanup(bag: CreatedUser[], orgPrefix: string) {
  for (const u of bag) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  await admin.from("tenants").delete().like("name", `RLS Org ${orgPrefix}%${RUN_ID}`);
}

export async function tenantIdOf(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data!.tenant_id as string;
}
