import { describe, expect, it } from "vitest";
import { compareRateLoading, computeCompliance } from "@/lib/rateLoading/comparator";
import {
  canonicalAmenities,
  canonicalAmenity,
  nightsBetween,
  normalizeCancellation,
  normalizeCurrency,
  normalizeLra,
  toPerNight,
} from "@/lib/rateLoading/normalize";
import { isUrlAllowed } from "@/lib/rateLoading/allowlist";
import { snapshotHash, stableStringify } from "@/lib/rateLoading/snapshot";
import type { ExpectedRateSnapshot, PortalRateOffer } from "@/lib/rateLoading/types";

const expected: ExpectedRateSnapshot = {
  hotel_name: "Copacabana Palace",
  city: "Rio de Janeiro",
  currency: "BRL",
  rate_amount: 500,
  rate_basis: "per_night",
  room_type: "Standard King",
  rate_plan: "Corporate LRA",
  corporate_rate_code: "TA2026",
  occupancy: { rooms: 1, adults: 1, children: 0 },
  check_in: "2026-10-01",
  check_out: "2026-10-04",
  number_of_nights: 3,
  lra: true,
  breakfast: true,
  wifi: true,
  parking: false,
  taxes_included: true,
  cancellation_policy: "Free cancellation until 24h",
  cancellation_hours: 24,
  refundable: true,
  mandatory_amenities: ["breakfast", "wifi"],
  optional_amenities: [],
};

const baseOffer: PortalRateOffer = {
  hotel_found: true,
  found: true,
  currency: "BRL",
  rate_amount: 500,
  rate_basis: "per_night",
  number_of_nights: 3,
  room_type: "Standard King",
  rate_plan: "Corporate LRA",
  rate_code: "TA2026",
  lra: true,
  refundable: true,
  taxes_included: true,
  cancellation_text: "Free cancellation until 24 hours before arrival",
  amenities: ["Buffet breakfast included", "Complimentary Wi-Fi"],
};

const opts = {
  tolerance: { amount: 0, percent: 2 },
  matchRoomType: true,
  matchRatePlan: true,
  requireLra: true,
  requireTaxesIncluded: true,
  matchCancellation: true,
};

describe("normalizers", () => {
  it("normalizes currency symbols and codes", () => {
    expect(normalizeCurrency("R$")).toBe("BRL");
    expect(normalizeCurrency("brl")).toBe("BRL");
    expect(normalizeCurrency("US$")).toBe("USD");
    expect(normalizeCurrency("Total USD 1200")).toBe("USD");
    expect(normalizeCurrency("")).toBeNull();
  });

  it("normalizes rate basis to per night", () => {
    expect(toPerNight(1500, "total_stay", 3)).toBe(500);
    expect(toPerNight(500, "per_night", 3)).toBe(500);
    expect(toPerNight(1500, "total_stay", 0)).toBeNull();
  });

  it("computes number of nights", () => {
    expect(nightsBetween("2026-10-01", "2026-10-04")).toBe(3);
    expect(nightsBetween("2026-10-01", "2026-10-01")).toBe(0);
  });

  it("maps amenity aliases", () => {
    expect(canonicalAmenity("Café da manhã incluído")).toBe("BREAKFAST");
    expect(canonicalAmenity("complimentary breakfast")).toBe("BREAKFAST");
    expect(canonicalAmenity("Wireless Internet")).toBe("WIFI");
    expect(canonicalAmenity("free wifi")).toBe("WIFI");
    expect(canonicalAmenities(["Estacionamento gratuito", "Academia"])).toEqual(["GYM", "PARKING"]);
  });

  it("normalizes cancellation policies", () => {
    expect(normalizeCancellation("Non-refundable").refundable).toBe(false);
    const parsed = normalizeCancellation("Free cancellation until 48 hours before arrival");
    expect(parsed.free_cancel_hours).toBe(48);
    expect(parsed.confidence).toBeGreaterThan(0.6);
    expect(normalizeCancellation("").confidence).toBe(0);
  });

  it("normalizes LRA / NLRA", () => {
    expect(normalizeLra("Corporate NLRA rate")).toBe(false);
    expect(normalizeLra("LRA guaranteed")).toBe(true);
    expect(normalizeLra("Corporate rate")).toBeNull();
  });
});

describe("comparator", () => {
  it("PASS_EXACT on a perfect match", () => {
    const r = compareRateLoading(expected, baseOffer, opts);
    expect(r.result_code).toBe("PASS_EXACT");
    expect(r.passed).toBe(true);
  });

  it("PASS_WITH_TOLERANCE inside percentage tolerance", () => {
    const r = compareRateLoading(expected, { ...baseOffer, rate_amount: 505 }, opts);
    expect(r.result_code).toBe("PASS_WITH_TOLERANCE");
    expect(r.passed).toBe(true);
  });

  it("PASS_WITH_TOLERANCE inside absolute tolerance", () => {
    const r = compareRateLoading(expected, { ...baseOffer, rate_amount: 520 }, {
      ...opts,
      tolerance: { amount: 25, percent: 0 },
    });
    expect(r.result_code).toBe("PASS_WITH_TOLERANCE");
  });

  it("normalizes total-stay offers before comparing", () => {
    const r = compareRateLoading(
      expected,
      { ...baseOffer, rate_amount: 1500, rate_basis: "total_stay" },
      opts,
    );
    expect(r.result_code).toBe("PASS_EXACT");
    expect(r.normalized_values.found_per_night).toBe(500);
  });

  it("RATE_VALUE_MISMATCH outside tolerance", () => {
    const r = compareRateLoading(expected, { ...baseOffer, rate_amount: 640 }, opts);
    expect(r.result_code).toBe("RATE_VALUE_MISMATCH");
    expect(r.passed).toBe(false);
  });

  it("CURRENCY_MISMATCH wins over rate mismatch", () => {
    const r = compareRateLoading(expected, { ...baseOffer, currency: "USD", rate_amount: 640 }, opts);
    expect(r.result_code).toBe("CURRENCY_MISMATCH");
  });

  it("BREAKFAST_MISMATCH when breakfast is missing", () => {
    const r = compareRateLoading(expected, { ...baseOffer, amenities: ["Complimentary Wi-Fi"] }, opts);
    expect(r.result_code).toBe("BREAKFAST_MISMATCH");
  });

  it("AMENITY_MISMATCH when a mandatory amenity other than breakfast is missing", () => {
    const r = compareRateLoading(expected, { ...baseOffer, amenities: ["Buffet breakfast included"] }, opts);
    expect(r.result_code).toBe("AMENITY_MISMATCH");
    expect(r.mismatches[0]!.field).toBe("amenity:WIFI");
  });

  it("extra amenities never fail", () => {
    const r = compareRateLoading(
      expected,
      { ...baseOffer, amenities: [...baseOffer.amenities, "Academia", "Transfer aeroporto"] },
      opts,
    );
    expect(r.passed).toBe(true);
  });

  it("LRA_MISMATCH when portal reports NLRA", () => {
    const r = compareRateLoading(expected, { ...baseOffer, lra: false }, opts);
    expect(r.result_code).toBe("LRA_MISMATCH");
  });

  it("MANUAL_REVIEW when LRA is inconclusive", () => {
    const r = compareRateLoading(expected, { ...baseOffer, lra: null }, opts);
    expect(r.result_code).toBe("MANUAL_REVIEW");
  });

  it("CANCELLATION_MISMATCH on non-refundable offer", () => {
    const r = compareRateLoading(
      expected,
      { ...baseOffer, cancellation_text: "Non-refundable rate" },
      opts,
    );
    expect(r.result_code).toBe("CANCELLATION_MISMATCH");
  });

  it("MANUAL_REVIEW when cancellation text is unparseable", () => {
    const r = compareRateLoading(expected, { ...baseOffer, cancellation_text: "See terms" }, opts);
    expect(r.result_code).toBe("MANUAL_REVIEW");
  });

  it("TAX_MISMATCH when taxes are not included", () => {
    const r = compareRateLoading(expected, { ...baseOffer, taxes_included: false }, opts);
    expect(r.result_code).toBe("TAX_MISMATCH");
  });

  it("ROOM_TYPE_MISMATCH and RATE_PLAN_MISMATCH", () => {
    expect(compareRateLoading(expected, { ...baseOffer, room_type: "Suite" }, opts).result_code).toBe(
      "ROOM_TYPE_MISMATCH",
    );
    expect(compareRateLoading(expected, { ...baseOffer, rate_plan: "Public BAR" }, opts).result_code).toBe(
      "RATE_PLAN_MISMATCH",
    );
  });

  it("HOTEL_NOT_FOUND and RATE_NOT_FOUND", () => {
    expect(compareRateLoading(expected, { ...baseOffer, hotel_found: false }, opts).result_code).toBe(
      "HOTEL_NOT_FOUND",
    );
    expect(
      compareRateLoading(expected, { ...baseOffer, found: false, rate_amount: null }, opts).result_code,
    ).toBe("RATE_NOT_FOUND");
    expect(compareRateLoading(expected, null, opts).result_code).toBe("HOTEL_NOT_FOUND");
  });
});

describe("compliance", () => {
  it("excludes technical errors from the denominator", () => {
    const { compliance, businessChecks } = computeCompliance([
      "PASS_EXACT",
      "PASS_WITH_TOLERANCE",
      "RATE_VALUE_MISMATCH",
      "PORTAL_ERROR",
      "LOGIN_FAILED",
    ]);
    expect(businessChecks).toBe(3);
    expect(Math.round(compliance)).toBe(67);
  });
});

describe("url allowlist", () => {
  const allowed = ["portal.acme.com"];
  it("accepts an allowed https host and subdomain", () => {
    expect(isUrlAllowed("https://portal.acme.com/search", allowed).allowed).toBe(true);
    expect(isUrlAllowed("https://eu.portal.acme.com/search", allowed).allowed).toBe(true);
  });
  it("rejects other domains, http, private ips and internal hosts", () => {
    expect(isUrlAllowed("https://evil.com", allowed).reason).toBe("domain_not_allowed");
    expect(isUrlAllowed("http://portal.acme.com", allowed).reason).toBe("protocol_not_https");
    expect(isUrlAllowed("https://127.0.0.1/x", allowed).reason).toBe("blocked_hostname");
    expect(isUrlAllowed("https://10.0.0.5/x", allowed).reason).toBe("private_ip");
    expect(isUrlAllowed("https://169.254.169.254/latest/meta-data", allowed).reason).toBe("private_ip");
    expect(isUrlAllowed("https://192.168.1.10", allowed).reason).toBe("private_ip");
    expect(isUrlAllowed("https://intranet/x", allowed).reason).toBe("internal_hostname");
    expect(isUrlAllowed("https://metadata.google.internal", allowed).reason).toBe("blocked_hostname");
    expect(isUrlAllowed("not-a-url", allowed).reason).toBe("invalid_url");
  });
  it("allows the mock portal on localhost only via an explicit mock entry", () => {
    expect(isUrlAllowed("http://127.0.0.1:8791/login", ["mock:127.0.0.1"]).allowed).toBe(true);
  });
});

describe("snapshot hashing", () => {
  it("is stable regardless of key order", async () => {
    const a = await snapshotHash({ a: 1, b: { c: 2, d: [1, 2] } });
    const b = await snapshotHash({ b: { d: [1, 2], c: 2 }, a: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when a value changes", async () => {
    expect(await snapshotHash({ rate: 500 })).not.toBe(await snapshotHash({ rate: 501 }));
  });
  it("sorts keys deterministically", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
