/**
 * Validates the internal TA staff invite flow:
 *  - TA master can insert into user_roles to promote any user to ta_staff.
 *  - Non-TA users (CORP/HOTEL/TMC) cannot insert ta_staff roles.
 *  - Once promoted, the new TA staff member sees all tenants.
 *  - Public signup with account_type=TA is silently rejected.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  admin,
  cleanup,
  createUser,
  describeIntegration as describe,
  PASSWORD,
  RUN_ID,
  signIn,
  type CreatedUser,
} from "./_helpers";

const PREFIX = "tainvite";
const created: CreatedUser[] = [];

let rootTaTenantId: string;
let taMaster: CreatedUser;
let invitee: CreatedUser;
let corpUser: CreatedUser;

beforeAll(async () => {
  // Resolve the root TA tenant (must already exist in seed data).
  const { data: ta, error: taErr } = await admin
    .from("tenants")
    .select("id")
    .eq("type", "TA")
    .limit(1)
    .single();
  if (taErr || !ta) throw taErr ?? new Error("Root TA tenant not found");
  rootTaTenantId = ta.id as string;

  // Make our own TA master via service role (no public signup grants TA).
  taMaster = await createUser(PREFIX, "master", "HOTEL", created);
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: taMaster.id, tenant_id: rootTaTenantId, role: "ta_master" });
  if (roleErr) throw roleErr;

  // Plain users
  invitee = await createUser(PREFIX, "invitee", "HOTEL", created);
  corpUser = await createUser(PREFIX, "corp", "CORP", created);
});

afterAll(async () => {
  await cleanup(created, PREFIX);
});

describe("TA invite flow", () => {
  it("public signup with account_type=TA grants no role", async () => {
    const taAttempt = await createUser(PREFIX, "taattempt", "TA", created);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", taAttempt.id);
    expect(roles ?? []).toHaveLength(0);
  });

  it("non-TA user cannot insert ta_staff role (RLS blocks)", async () => {
    const cli = await signIn(corpUser.email);
    const { error } = await cli
      .from("user_roles")
      .insert({ user_id: invitee.id, tenant_id: rootTaTenantId, role: "ta_staff" });
    expect(error).toBeTruthy();
  });

  it("TA master can promote a user to ta_staff", async () => {
    const cli = await signIn(taMaster.email);
    const { error } = await cli
      .from("user_roles")
      .insert({ user_id: invitee.id, tenant_id: rootTaTenantId, role: "ta_staff" });
    expect(error).toBeNull();

    const { data } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", invitee.id)
      .eq("role", "ta_staff");
    expect(data).toHaveLength(1);
    expect(data![0].tenant_id).toBe(rootTaTenantId);
  });

  it("freshly promoted TA staff sees all tenants (across types)", async () => {
    // Re-sign-in to refresh JWT claims (role lookup happens via auth.uid()).
    const cli = await signIn(invitee.email);
    const { data, error } = await cli.from("tenants").select("id, type");
    expect(error).toBeNull();
    const types = new Set((data ?? []).map((t) => t.type));
    // At minimum, the TA staff should now see the root TA tenant + their own
    // hotel tenant + the corpUser's CORP tenant created in setup.
    expect(types.has("TA")).toBe(true);
    expect(types.has("CORP")).toBe(true);
  });

  it("regular hotel user CANNOT see foreign tenants (negative control)", async () => {
    // Use a fresh hotel user that was NOT promoted.
    const stranger = await createUser(PREFIX, "stranger", "HOTEL", created);
    // Re-authenticate with their fresh creds.
    void PASSWORD;
    const cli = await signIn(stranger.email);
    const { data } = await cli.from("tenants").select("id, type");
    // Should only see own hotel tenant — not TA root, not corpUser tenant.
    const types = (data ?? []).map((t) => t.type);
    expect(types.every((t) => t === "HOTEL")).toBe(true);
    expect(data!.length).toBe(1);
    void RUN_ID;
  });
});
