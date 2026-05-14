/**
 * Cross-tenant UPDATE/DELETE on bookings.
 *
 * Policies under test:
 *  - "Visible tenants update bookings"  (UPDATE — using + with check)
 *  - "TA master deletes bookings"        (DELETE — only TA master)
 *
 * Expectations:
 *  - CorpA can UPDATE its own bookings.
 *  - CorpA's UPDATE on CorpB's bookings affects 0 rows (RLS filters silently).
 *  - CorpA cannot DELETE any booking (no DELETE policy for corp role).
 *  - TA master can DELETE bookings.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  admin,
  cleanup,
  createUser,
  describeIntegration as describe,
  hasIntegrationEnv,
  RUN_ID,
  signIn,
  tenantIdOf,
  type CreatedUser,
} from "./_helpers";

const PREFIX = "bookcross";
const created: CreatedUser[] = [];

let corpA: CreatedUser;
let corpB: CreatedUser;
let taMaster: CreatedUser;
let bookingA: string;
let bookingB: string;

beforeAll(async () => {
  if (!hasIntegrationEnv) return;
  corpA = await createUser(PREFIX, "corpA", "CORP", created);
  corpB = await createUser(PREFIX, "corpB", "CORP", created);

  // TA master via service-role
  const { data: ta } = await admin
    .from("tenants")
    .select("id")
    .eq("type", "TA")
    .limit(1)
    .single();
  taMaster = await createUser(PREFIX, "tamaster", "HOTEL", created);
  await admin
    .from("user_roles")
    .insert({ user_id: taMaster.id, tenant_id: ta!.id, role: "ta_master" });

  const tenantA = await tenantIdOf(corpA.id);
  const tenantB = await tenantIdOf(corpB.id);

  const { data: bA, error: eA } = await admin
    .from("bookings")
    .insert({
      client_tenant_id: tenantA,
      hotel_name: `BCross-A ${RUN_ID}`,
      city: "São Paulo",
      room_nights: 1,
      adr: 100,
    })
    .select("id")
    .single();
  if (eA) throw eA;
  bookingA = bA!.id as string;

  const { data: bB, error: eB } = await admin
    .from("bookings")
    .insert({
      client_tenant_id: tenantB,
      hotel_name: `BCross-B ${RUN_ID}`,
      city: "Rio",
      room_nights: 1,
      adr: 100,
    })
    .select("id")
    .single();
  if (eB) throw eB;
  bookingB = bB!.id as string;
});

afterAll(async () => {
  if (!hasIntegrationEnv) return;
  await admin.from("bookings").delete().in("id", [bookingA, bookingB]);
  await cleanup(created, PREFIX);
});

describe("bookings UPDATE cross-tenant", () => {
  it("CorpA UPDATE own booking succeeds", async () => {
    const cli = await signIn(corpA.email);
    const { error } = await cli
      .from("bookings")
      .update({ adr: 222 })
      .eq("id", bookingA);
    expect(error).toBeNull();

    const { data } = await admin
      .from("bookings")
      .select("adr")
      .eq("id", bookingA)
      .single();
    expect(Number(data!.adr)).toBe(222);
  });

  it("CorpA UPDATE on CorpB booking affects 0 rows (RLS hides target)", async () => {
    const cli = await signIn(corpA.email);
    await cli.from("bookings").update({ adr: 999 }).eq("id", bookingB);

    const { data } = await admin
      .from("bookings")
      .select("adr")
      .eq("id", bookingB)
      .single();
    expect(Number(data!.adr)).not.toBe(999);
  });
});

describe("bookings DELETE", () => {
  it("CorpA cannot DELETE any booking (no policy)", async () => {
    const cli = await signIn(corpA.email);
    await cli.from("bookings").delete().eq("id", bookingA);
    const { data } = await admin
      .from("bookings")
      .select("id")
      .eq("id", bookingA)
      .maybeSingle();
    expect(data).toBeTruthy();
  });

  it("CorpA cannot DELETE CorpB booking", async () => {
    const cli = await signIn(corpA.email);
    await cli.from("bookings").delete().eq("id", bookingB);
    const { data } = await admin
      .from("bookings")
      .select("id")
      .eq("id", bookingB)
      .maybeSingle();
    expect(data).toBeTruthy();
  });

  it("TA master can DELETE bookings", async () => {
    const cli = await signIn(taMaster.email);
    const { error } = await cli.from("bookings").delete().eq("id", bookingA);
    expect(error).toBeNull();
    const { data } = await admin
      .from("bookings")
      .select("id")
      .eq("id", bookingA)
      .maybeSingle();
    expect(data).toBeNull();
  });
});
