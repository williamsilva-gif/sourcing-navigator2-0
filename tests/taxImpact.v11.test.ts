import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  defaultScenario,
  referenceRates,
  simulateNight,
  budget,
  scenarioSchema,
  negotiate,
} from "../src/lib/taxImpact/simulation";
import { volumeBook, parseVolume, volumeStats, matchVolumes, volumeProvenance } from "../src/lib/taxImpact/volume";
import { parseCbsReference, fetchOfficialSources, saoPauloDay } from "../src/lib/taxImpact/sources";
import { chargeValue, comparePrograms, type Row } from "../src/lib/taxImpact/core";
import { excelReport, pdfReport } from "../src/lib/taxImpact/exports";
const row = (changes: Partial<Row> = {}): Row => ({
  id: "a",
  hash: "x",
  hotel: "Comfort Hotel Goiânia",
  network: "Atlantica",
  city: "Goiânia",
  state: "GO",
  cnpj: "01234567000189",
  currency: "BRL",
  single: 253.67,
  double: 300,
  rateType: "fixed",
  chargeBasis: "quoted",
  floatingDiscount: chargeValue(""),
  iss: chargeValue("5%"),
  service: chargeValue("Inclusa na tarifa"),
  lra: "LRA",
  breakfast: "yes",
  wifi: "yes",
  parking: "no",
  minibar: "no",
  start: "",
  end: "",
  status: "pending",
  statusRaw: "Para aprovação Cliente",
  source: { file: "demo.xlsx", sheet: "Tarifas", row: 3, columns: {} },
  ...changes,
});
const pair = comparePrograms([row()], [row({ id: "b", single: 261.79 })])[0];
const scenario = {
  ...defaultScenario,
  regime2026: "cumulative",
  regime2027: "regular",
  inclusion: "inclusive",
} as const;
describe("TIC v1.1 deterministic scenarios", () => {
  it("applies 0.10pp before 40% lodging reduction", () => {
    expect(referenceRates().cbs).toBeCloseTo(6.72, 10);
    expect(referenceRates().ibs).toBeCloseTo(0.06, 10);
  });
  it("Comfort inclusive cumulative proxy, separate taxes and unchanged gross", () => {
    const s = simulateNight(pair, "single", scenario);
    expect(s.neutral).toBe(262.67);
    expect(s.residual).toBe(-0.88);
    expect(s.after).toMatchObject({ cbs: 17.59, ibs: 0.16, iss: 13.09, total: 261.79 });
  });
  it("9.25% explicitly illustrative hypothesis", () => {
    const s = simulateNight(pair, "single", { ...scenario, regime2026: "illustrative" });
    expect(s.neutral).toBe(246.57);
    expect(s.residual).toBe(15.22);
  });
  it("extra charges use explicitly assumed net base; included service not counted again", () => {
    const s = simulateNight(pair, "single", { ...scenario, inclusion: "extra" });
    expect(s.after?.total).toBe(292.63);
    expect(s.after?.service).toBeNull();
    expect(s.neutral).toBeNull();
  });
  it("unknown and Simples block tax conclusions", () => {
    expect(simulateNight(pair, "single", defaultScenario).neutral).toBeNull();
    expect(simulateNight(pair, "single", { ...scenario, regime2026: "simples" }).after).toBeNull();
  });
  it("included ISS requires explicit nominal percentage, missing is not zero", () => {
    const p = comparePrograms(
      [row({ iss: chargeValue("Inclusa na tarifa") })],
      [row({ id: "b", iss: chargeValue("Inclusa na tarifa") })],
    )[0];
    expect(simulateNight(p, "single", scenario).before).toBeNull();
    expect(simulateNight(p, "single", { ...scenario, issIncludedPct: 5 }).before?.iss).toBe(12.68);
  });
  it("budget requires explicit mix, allows zero volume and boundary mix", () => {
    expect(budget(400, 448, 460, 515.2, 100, null)).toBeNull();
    expect(budget(400, 448, null, null, 0, 100)?.delta).toBe(0);
    expect(budget(400, 448, null, null, 100, 100)?.delta).toBe(4800);
  });
  it("growth boundaries enforce -50 to 100%", () => {
    expect(scenarioSchema.safeParse({ growthPct: 101 }).success).toBe(false);
    expect(scenarioSchema.parse({ growthPct: -50 }).growthPct).toBe(-50);
  });
});
describe("Historical volume", () => {
  it("real monthly metadata preserves lack of original while synthetic stays distinct",()=>{
    expect(volumeProvenance({filename:'Deloitte REAL Base Volume.xlsx',mapping:{kind:'real_monthly_rollup',original_in_storage:false,source_records:13279}})).toMatchObject({kind:'real_monthly_rollup',originalInStorage:false,sourceRecords:13279});
    expect(volumeProvenance({filename:'volume-SIMULADO.xlsx',mapping:{columns:{}}}).kind).toBe('synthetic');
    expect(volumeProvenance({filename:'REAL.xlsx',mapping:{}}).kind).toBe('uploaded');
  });
  it("parses 13,279 synthetic real-shaped XLSX rows, CNPJ and weighted ADR", () => {
    const wb = XLSX.utils.book_new();
    const grid: unknown[][] = [
      [
        "Mês check in",
        "Ano check in",
        "Grupo Fornecedor",
        "Fornecedor",
        "CNPJ",
        "Bairro",
        "Cidade",
        "Estado",
        "Data Emissão",
        "Data in",
        "Data out",
        "Grupo Empresarial",
        "Cliente",
        "Diárias",
        "Tarifa",
      ],
    ];
    for (let i = 0; i < 13279; i++)
      grid.push([
        1,
        2026,
        "Atlantica",
        "Comfort Hotel Goiânia",
        "01234567000189",
        "",
        "Goiânia",
        "GO",
        "",
        "2026-01-10",
        "",
        "",
        "",
        i % 2 ? 2 : 1,
        i % 2 ? 600 : 200,
      ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), "Base Volume");
    const bytes = new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }),
    );
    const parsed = parseVolume(volumeBook(bytes), "Base Volume", {
      month: 0,
      year: 1,
      network: 2,
      hotel: 3,
      cnpj: 4,
      city: 6,
      state: 7,
      checkin: 9,
      nights: 13,
      amount: 14,
    });
    expect(parsed.rows).toHaveLength(13279);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0].cnpj).toBe("01234567000189");
    const stats = volumeStats(parsed.rows);
    expect(stats.adr26).toBeCloseTo(
      parsed.rows.reduce((a, r) => a + r.amount, 0) / parsed.rows.reduce((a, r) => a + r.nights, 0),
    );
  });
  it("portfolio projection is 27,407 nights and growth applies", () => {
    const r = (year: number, month: number, nights: number) => ({
      row: 1,
      year,
      month,
      nights,
      amount: 100,
      hotel: "h",
      network: "n",
      cnpj: "",
      city: "c",
      state: "s",
    });
    const data = [r(2025, 1, 10109), r(2025, 6, 14065), r(2026, 1, 11461)];
    const s = volumeStats(data);
    expect(s.fy25).toBe(24174);
    expect(Math.round(s.projected26 ?? 0)).toBe(27407);
    expect(volumeStats(data, 100).projected27).toBeCloseTo((s.projected26 ?? 0) * 2);
  });
  it("own seasonality thresholds and fallback; missing 2026 disabled", () => {
    const data = [
      {
        row: 1,
        year: 2025,
        month: 1,
        nights: 12,
        amount: 100,
        hotel: "h",
        network: "n",
        cnpj: "",
        city: "c",
        state: "s",
      },
      {
        row: 2,
        year: 2025,
        month: 6,
        nights: 18,
        amount: 100,
        hotel: "h",
        network: "n",
        cnpj: "",
        city: "c",
        state: "s",
      },
      {
        row: 3,
        year: 2026,
        month: 1,
        nights: 10,
        amount: 100,
        hotel: "h",
        network: "n",
        cnpj: "",
        city: "c",
        state: "s",
      },
    ];
    expect(volumeStats(data, 0, 0.4181765533).method).toBe("hotel");
    expect(volumeStats(data.slice(1), 0, 0.4181765533).method).toBe("fallback portfolio");
    expect(volumeStats(data.slice(0, 2)).projected26).toBeNull();
  });
  it("shared CNPJ is ambiguous and never duplicated", () => {
    const v = [
      {
        row: 1,
        year: 2026,
        month: 1,
        nights: 10,
        amount: 100,
        hotel: "h",
        network: "n",
        cnpj: "01234567000189",
        city: "c",
        state: "s",
      },
    ];
    const m = matchVolumes([row(), row({ id: "other", hotel: "other" })], v);
    expect(m.assignments.size).toBe(0);
    expect(m.ambiguous).toHaveLength(1);
  });
});
describe("Sources and exports", () => {
  it("included service is unsegregated, not zero", () => {
    expect(simulateNight(pair, "single", scenario).after?.service).toBeNull();
  });
  it("pending and objective counterproposal preserved", () => {
    const p = comparePrograms([row({ single: 400 })], [row({ id: "b", single: 448 })])[0];
    expect(negotiate(p, { ...scenario, maxIncrease: 5 }, null)).toMatchObject({
      action: "RENEGOCIAR",
      counter: 420,
    });
    expect(p.status).toBe("pending");
  });
  it("neutral objective without confirmed base is insufficient", () => {
    expect(negotiate(pair, { ...defaultScenario, negotiateNeutral: true }, null).action).toBe(
      "INSUFICIENTE",
    );
  });
  it("CSV excludes zero/negative values and off-window checkins", () => {
    const text =
      "Fornecedor,CNPJ,Data in,Diárias,Tarifa\nHotel,7037213000137,2026-06-01,2,800\nHotel,7037213000137,2026-01-01,0,100\nHotel,7037213000137,2026-01-01,1,-100";
    const wb = volumeBook(new TextEncoder().encode(text), true);
    const p = parseVolume(wb, wb.SheetNames[0], {
      hotel: 0,
      cnpj: 1,
      checkin: 2,
      nights: 3,
      amount: 4,
    });
    expect(p.rows[0].cnpj).toBe("07037213000137");
    expect(p.errors).toHaveLength(2);
    expect(volumeStats(p.rows).n26).toBe(0);
  });
  it("tolerant CBS parser preserves precise and rounded reference", () => {
    expect(parseCbsReference("<b>CBS</b> referência 11,3468% arredondada 11,3%")).toEqual({
      reference: 11.3468,
      rounded: 11.3,
    });
    expect(parseCbsReference("CBS 11,3% CBS 20,0%")).toBeNull();
  });
  it("São Paulo day differs before 03 UTC", () => {
    expect(saoPauloDay(new Date("2026-10-29T01:00:00Z"))).toBe("2026-10-28");
  });
  it("mock success does not claim Senate verification", async () => {
    const result = await fetchOfficialSources(
      async () => new Response("CBS alíquota de referência 11,3468%"),
    );
    expect(result.tcu.status).toBe("validated");
    expect(result.senate.status).toBe("unverified");
  });
  it("mock failure never green", async () => {
    const result = await fetchOfficialSources(async () => {
      throw new Error("offline");
    });
    expect(result.tcu.status).toBe("unverified");
    expect(result.message).toContain("Não foi possível");
  });
  it("real PDF and filtered XLSX with formulas and simulation markers", () => {
    const data = {
      name: "DEMO SIMULAÇÃO",
      results: [pair],
      scenario,
      source: null,
      volumeSummary: null,
    };
    const x = excelReport(data),
      wb = XLSX.read(x, { type: "array", cellFormula: true });
    expect(wb.Sheets["Comparação filtrada"]["R2"].f).toContain("ROUND(G2");
    expect(XLSX.utils.sheet_to_json(wb.Sheets["Comparação filtrada"])).toHaveLength(1);
    expect(new TextDecoder().decode(pdfReport(data).slice(0, 4))).toBe("%PDF");
  });
});
