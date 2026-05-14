/**
 * TMC signup + cross-isolation.
 *
 * Validates:
 *  - Public signup with account_type=TMC creates a TMC tenant + tmc_admin role
 *    and sets profiles.primary_tenant_id.
 *  - TMC_A cannot see TMC_B's tenant.
 *  - HOTEL user cannot see TMC tenants.
 *  - TMC_A can insert a child CORP tenant; CorpA cannot.
 *  - TMC_A cannot insert bookings on TMC_B's tenant.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  admin,
  cleanup,
  createUser,
  describeIntegration as describe,
  RUN_ID,
  signIn,
  tenantIdOf,
  type CreatedUser,
} from "./_helpers";

const PREFIX = "tmcsign";
const created: CreatedUser[] = [];

let tmcA: CreatedUser;
let tmcB: CreatedUser;
let hotelA: CreatedUser;
let corpA: CreatedUser;

beforeAll(async () => {
  tmcA = await createUser(PREFIX, "tmcA", "TMC", created);
  tmcB = await createUser(PREFIX, "tmcB", "TMC", created);
  hotelA = await createUser(PREFIX, "hotelA", "HOTEL", created);
  corpA = await createUser(PREFIX, "corpA", "CORP", created);
});

afterAll(async () => {
  // Drop child CORP tenants created during the test
  await admin.from("tenants").delete().like("name", `Child CORP%${RUN_ID}`);
  await cleanup(created, PREFIX);
});

describe("TMC signup", () => {
  it("creates TMC tenant + tmc_admin role + primary_tenant_id", async () => {
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, tenants:tenant_id(type, name)")
      .eq("user_id", tmcA.id);
    expect(roles).toHaveLength(1);
    expect(roles![0].role).toBe("tmc_admin");
    // @ts-expect-error joined shape
    expect(roles![0].tenants.type).toBe("TMC");

    const { data: profile } = await admin
      .from("profiles")
      .select("primary_tenant_id")
      .eq("id", tmcA.id)
      .single();
    expect(profile!.primary_tenant_id).toBeTruthy();
  });
});

describe("TMC cross-isolation", () => {
  it("TMC_A cannot see TMC_B tenant", async () => {
    const tmcBTenant = await tenantIdOf(tmcB.id);
    const cli = await signIn(tmcA.email);
    const { data } = await cli.from("tenants").select("id").eq("id", tmcBTenant);
    expect(data ?? []).toHaveLength(0);
  });

  it("Hotel user cannot see TMC tenant", async () => {
    const tmcATenant = await tenantIdOf(tmcA.id);
    const cli = await signIn(hotelA.email);
    const { data } = await cli.from("tenants").select("id").eq("id", tmcATenant);
    expect(data ?? []).toHaveLength(0);
  });

  it("TMC_A can insert a child CORP tenant", async () => {
    const tmcATenant = await tenantIdOf(tmcA.id);
    const cli = await signIn(tmcA.email);
    const { error } = await cli.from("tenants").insert({
      type: "CORP",
      name: `Child CORP via TMC ${RUN_ID}`,
      parent_tenant_id: tmcATenant,
    });
    expect(error).toBeNull();
  });

  it("CorpA cannot insert a child tenant", async () => {
    const corpATenant = await tenantIdOf(corpA.id);
    const cli = await signIn(corpA.email);
    const { error } = await cli.from("tenants").insert({
      type: "CORP",
      name: `Child CORP forbidden ${RUN_ID}`,
      parent_tenant_id: corpATenant,
    });
    expect(error).toBeTruthy();
  });

  it("TMC_A cannot insert bookings on TMC_B tenant", async () => {
    const tmcBTenant = await tenantIdOf(tmcB.id);
    const cli = await signIn(tmcA.email);
    const { error } = await cli.from("bookings").insert({
      client_tenant_id: tmcBTenant,
      hotel_name: `TmcLeak ${RUN_ID}`,
      city: "X",
      room_nights: 1,
      adr: 1,
    });
    expect(error).toBeTruthy();
  });
});
