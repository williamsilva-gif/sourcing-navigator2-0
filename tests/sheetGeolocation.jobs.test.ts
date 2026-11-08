import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { completedJob, enrich, parseSheet, suggest, type Row } from "../src/lib/sheetGeolocation/core";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder,
    handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("../src/lib/proximity/google.server", () => ({ google: vi.fn() }));
import { google } from "../src/lib/proximity/google.server";
import { batchSheetJob, getSheetJob } from "../src/lib/sheetGeolocation/jobs.functions";
const provider = vi.mocked(google);
const headers = ["Logradouro", "Número", "Cidade", "UF", "CEP", "CPF"];
function fixture() {
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([headers,
    ["Rua Um", "10", "São Paulo", "SP", "01234567", "00123456789"],
    ["Rua Dois", "20", "São Paulo", "SP", "01234567", "00223456789"],
    ["Rua Três", "30", "São Paulo", "SP", "01234567", "00323456789"]]), "Original");
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([["Não modificar"], [12.5]]), "Outra");
  return w;
}
function high(row: Row) {
  return { status: "OK", results: [{ place_id: `mock-${row.index}`, formatted_address: row.entity.address,
    geometry: { location: { lat: -23.5, lng: -46.6 }, location_type: "ROOFTOP" },
    address_components: [
      ["locality", "São Paulo", "São Paulo"], ["administrative_area_level_1", "São Paulo", "SP"],
      ["country", "Brasil", "BR"], ["postal_code", "01234567", "01234567"],
      ["street_number", row.entity.number, row.entity.number], ["route", row.entity.address, row.entity.address],
    ].map(([type, long_name, short_name]) => ({ types: [type], long_name, short_name })) }] };
}
function harness() {
  const rows = parseSheet(fixture(), "Original", 1, suggest(headers), "office", "mock.xlsx");
  const job = { id: "job", client_tenant_id: "tenant", status: "running", checkpoint: 0,
    rows, requests_reserved: 0, request_budget: 10, lease_token: "token", lease_until: "future",
    updated_at: "snapshot", next_batch_at: null as string | null, last_error: null as string | null };
  let failSave = false;
  const client = {
    rpc: async (name: string, args: { _token?: string }) => {
      if (name === "sheet_geo_claim") job.lease_token = args._token ?? "token";
      return { data: name === "proximity_access" ? true : [structuredClone(job)], error: null };
    },
    from: () => {
      let patch: Record<string, unknown> | undefined;
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q, update: (p: Record<string, unknown>) => { patch = p; return q; },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
        not: (_key: string, _op: string, _value: string) => q,
        single: () => execute(true), maybeSingle: () => execute(true),
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(execute(false)).then(resolve),
      };
      function execute(single: boolean) {
        if (failSave && patch?.rows) return { data: null, error: { message: "save failed" } };
        const match = filters.every(([key, value]) => key === "rows"
          ? JSON.stringify(job.rows) === value : job[key as keyof typeof job] === value);
        if (!match) return { data: single ? null : [], error: null };
        if (patch) Object.assign(job, structuredClone(patch));
        return { data: single ? structuredClone(job) : [structuredClone(job)], error: null };
      }
      return q;
    },
  };
  // The mocked builder exposes the actual handler: no RPC or real database/provider requests.
  const invoke = (fn: unknown) => (fn as (input: unknown) => Promise<unknown>)({
    data: { tenantId: "tenant", jobId: "job" }, context: { supabase: client },
  });
  return { job, invoke, failPersistence: () => { failSave = true; } };
}
beforeEach(() => { provider.mockReset(); });
describe("Sheet batch durable outcomes (no paid provider)", () => {
  it("processes high -> malformed error -> high without pausing or losing prior results", async () => {
    const h = harness();
    provider.mockResolvedValueOnce(high(h.job.rows[0])).mockRejectedValueOnce(new TypeError("Cannot read properties of undefined (reading includes)"))
      .mockResolvedValueOnce(high(h.job.rows[2]));
    await h.invoke(batchSheetJob);
    expect(h.job.rows.map((r) => r.status)).toEqual(["high", "error", "high"]);
    expect(h.job.status).toBe("processed");
    expect(h.job.checkpoint).toBe(3);
    expect(h.job.lease_token).toBeNull();
    expect(h.job.last_error).toBeNull();
    expect(h.job.rows[1].history[0].notes[0]).toContain("malformada");
  });
  it("last error concludes and XLSX preserves every original cell/row/other sheet", async () => {
    const h = harness();
    provider.mockResolvedValueOnce(high(h.job.rows[0])).mockResolvedValueOnce(high(h.job.rows[1]))
      .mockResolvedValueOnce({ status: "ZERO_RESULTS", results: [] });
    await h.invoke(batchSheetJob);
    expect(h.job.status).toBe("processed");
    expect(h.job.rows[2].status).toBe("error");
    const w = fixture();
    const original = structuredClone(w);
    enrich(w, "Original", 1, h.job.rows);
    const exported = XLSX.read(XLSX.write(w, { type: "array", bookType: "xlsx" }), { type: "array" });
    for (const [address, cell] of Object.entries(original.Sheets.Original)) {
      if (!address.startsWith("!")) expect(exported.Sheets.Original[address].v).toEqual(cell.v);
    }
    expect(exported.Sheets.Original.I4.v).toBe("error");
    expect(exported.Sheets.Outra.A2.v).toBe(12.5);
    expect(exported.Sheets.Original.F2.v).toBe("00123456789");
  });
  it("exhausted third transient attempt becomes error and following rows continue", async () => {
    const h = harness(); h.job.rows[0].attempts = 2;
    provider.mockRejectedValueOnce(new Error("Google HTTP 503"))
      .mockResolvedValueOnce(high(h.job.rows[1])).mockResolvedValueOnce(high(h.job.rows[2]));
    await h.invoke(batchSheetJob);
    expect(h.job.rows.map((r) => r.status)).toEqual(["error", "high", "high"]);
    expect(h.job.rows[0].attempts).toBe(3);
    expect(h.job.rows[0].nextRetry).toBeUndefined();
    expect(h.job.status).toBe("processed");
    await h.invoke(batchSheetJob); // fake claim still returns job: resolved rows never called again
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it("transient retry persists backoff and does not hold up later rows", async () => {
    const h = harness();
    provider.mockRejectedValueOnce(new Error("Google HTTP 429"))
      .mockResolvedValueOnce(high(h.job.rows[1])).mockResolvedValueOnce(high(h.job.rows[2]));
    await h.invoke(batchSheetJob);
    expect(h.job.rows.map((r) => r.status)).toEqual(["pending", "high", "high"]);
    expect(h.job.rows[0].nextRetry).toBeGreaterThan(Date.now());
    expect(h.job.status).toBe("running");
    expect(h.job.next_batch_at).toBe(new Date(h.job.rows[0].nextRetry ?? 0).toISOString());
  });
  it.each(["REQUEST_DENIED", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"])("fatal %s pauses without calling following rows", async (status) => {
    const h = harness(); provider.mockResolvedValue({ status });
    await h.invoke(batchSheetJob);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(h.job.status).toBe("paused");
    expect(h.job.rows.every((r) => r.status === "pending")).toBe(true);
    expect(h.job.requests_reserved).toBe(1);
  });
  it("budget exhaustion pauses before any additional charge", async () => {
    const h = harness(); h.job.requests_reserved = h.job.request_budget;
    await h.invoke(batchSheetJob);
    expect(provider).not.toHaveBeenCalled();
    expect(h.job.status).toBe("paused");
    expect(h.job.requests_reserved).toBe(10);
    expect(h.job.rows[0].status).toBe("pending");
  });
  it("persistence failure stops calls and cannot mark unsaved rows complete", async () => {
    const h = harness(); h.failPersistence(); provider.mockResolvedValue(high(h.job.rows[0]));
    await h.invoke(batchSheetJob);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(h.job.status).toBe("paused");
    expect(h.job.checkpoint).toBe(0);
    expect(h.job.rows[0].status).toBe("pending");
  });
  it("reload normalizes only fully checkpointed paused jobs, idempotently and without Google", async () => {
    const h = harness(); h.job.status = "paused";
    h.job.rows.forEach((r) => { r.status = "error"; }); h.job.checkpoint = 3;
    const before = structuredClone(h.job.rows);
    expect(completedJob(h.job)).toBe(true);
    await h.invoke(getSheetJob); await h.invoke(getSheetJob);
    expect(h.job.status).toBe("processed");
    expect(h.job.rows).toEqual(before);
    expect(h.job.requests_reserved).toBe(0);
    expect(provider).not.toHaveBeenCalled();
    h.job.status = "paused"; h.job.rows[1].status = "pending";
    expect(completedJob(h.job)).toBe(false);
    await h.invoke(getSheetJob);
    expect(h.job.status).toBe("paused");
  });
});