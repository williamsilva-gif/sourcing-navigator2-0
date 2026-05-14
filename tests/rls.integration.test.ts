/**
 * RLS integration tests
 *
 * Validates:
 *  - Public signup with account_type=TA does NOT grant any TA role/tenant
 *    (the handle_new_user trigger silently rejects TA).
 *  - Hotel/TMC/Corp signup creates the tenant + admin role.
 *  - RLS prevents cross-tenant reads/writes for bookings and tenants.
 *  - Non-TA users cannot insert into the tenants table.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (already provided
 * by Lovable Cloud at runtime). Tests create temporary users prefixed with
 * `rlstest+` and clean them (and their cascading tenants/roles) at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Math.random().toString(36).slice(2, 8);
const PASSWORD = "Test!12345";

type AccountType = "HOTEL" | "TMC" | "CORP" | "TA";
const created: { id: string; email: string }[] = [];

async function createUser(label: string, accountType: AccountType) {
  const email = `rlstest+${RUN_ID}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `RLS ${label}`,
      account_type: accountType,
      org_name: `RLS Org ${label} ${RUN_ID}`,
    },
  });
  if (error || !data.user) throw error ?? new Error("user not created");
  created.push({ id: data.user.id, email });
  return { id: data.user.id, email };
}

function userClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string) {
  const c = userClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

let hotelA: { id: string; email: string };
let corpA: { id: string; email: string };
let corpB: { id: string; email: string };
let taAttempt: { id: string; email: string };

beforeAll(async () => {
  hotelA = await createUser("hotelA", "HOTEL");
  corpA = await createUser("corpA", "CORP");
  corpB = await createUser("corpB", "CORP");
  taAttempt = await createUser("taAttempt", "TA");
});

afterAll(async () => {
  // Delete users — cascades to user_roles via FK; tenants are then orphaned and
  // we remove them by name pattern via the service role.
  for (const u of created) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  await admin.from("tenants").delete().like("name", `RLS Org%${RUN_ID}`);
});

describe("handle_new_user trigger", () => {
  it("rejects TA from public signup (no role, no tenant)", async () => {
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", taAttempt.id);
    expect(roles ?? []).toHaveLength(0);

    const { data: profile } = await admin
      .from("profiles")
      .select("primary_tenant_id")
      .eq("id", taAttempt.id)
      .single();
    expect(profile?.primary_tenant_id).toBeNull();

    const { data: tenants } = await admin
      .from("tenants")
      .select("id")
      .like("name", `RLS Org taAttempt ${RUN_ID}%`);
    expect(tenants ?? []).toHaveLength(0);
  });

  it("creates HOTEL tenant + hotel_admin role", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role, tenants:tenant_id(type, name)")
      .eq("user_id", hotelA.id);
    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("hotel_admin");
    // @ts-expect-error joined shape
    expect(data![0].tenants.type).toBe("HOTEL");
  });

  it("creates CORP tenant + corp_admin role", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role, tenants:tenant_id(type)")
      .eq("user_id", corpA.id);
    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("corp_admin");
    // @ts-expect-error joined shape
    expect(data![0].tenants.type).toBe("CORP");
  });
});

describe("RLS — tenant visibility", () => {
  it("CorpA cannot see CorpB's tenant", async () => {
    const { data: corpBRole } = await admin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", corpB.id)
      .single();
    const corpBTenantId = corpBRole!.tenant_id;

    const cli = await signIn(corpA.email);
    const { data } = await cli.from("tenants").select("id").eq("id", corpBTenantId);
    expect(data ?? []).toHaveLength(0);
  });

  it("CorpA cannot insert directly into tenants (only TA master can)", async () => {
    const cli = await signIn(corpA.email);
    const { error } = await cli
      .from("tenants")
      .insert({ type: "CORP", name: `Sneaky ${RUN_ID}` });
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toMatch(/row-level security|violates/);
  });

  it("Hotel user cannot insert tenant either", async () => {
    const cli = await signIn(hotelA.email);
    const { error } = await cli
      .from("tenants")
      .insert({ type: "HOTEL", name: `Sneaky2 ${RUN_ID}` });
    expect(error).toBeTruthy();
  });
});

describe("RLS — bookings cross-tenant", () => {
  it("CorpA cannot insert bookings on CorpB tenant", async () => {
    const { data: corpBRole } = await admin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", corpB.id)
      .single();

    const cli = await signIn(corpA.email);
    const { error } = await cli.from("bookings").insert({
      client_tenant_id: corpBRole!.tenant_id,
      hotel_name: "X",
      city: "São Paulo",
      room_nights: 1,
      adr: 100,
    });
    expect(error).toBeTruthy();
  });

  it("CorpA can insert bookings on its own tenant; CorpB cannot read them", async () => {
    const { data: corpARole } = await admin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", corpA.id)
      .single();

    const cliA = await signIn(corpA.email);
    const { error: insErr } = await cliA.from("bookings").insert({
      client_tenant_id: corpARole!.tenant_id,
      hotel_name: `Marker ${RUN_ID}`,
      city: "Rio",
      room_nights: 2,
      adr: 200,
    });
    expect(insErr).toBeNull();

    const cliB = await signIn(corpB.email);
    const { data: leak } = await cliB
      .from("bookings")
      .select("id")
      .eq("hotel_name", `Marker ${RUN_ID}`);
    expect(leak ?? []).toHaveLength(0);
  });
});
