import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  calculate,
  coords,
  supplement,
  haversine,
  band,
  EARTH_KM,
  type Point,
} from "../src/lib/crossingTenKm/core";
import { parseSupplement, exportWorkbook } from "../src/lib/crossingTenKm/files";
const p = (
  kind: Point["kind"],
  id: string,
  lat: unknown = -23,
  lng: unknown = -46,
  rest: Partial<Point> = {},
): Point => ({
  id,
  kind,
  code: id,
  name: id,
  address: "Rua",
  number: "",
  city: "São Paulo",
  uf: "SP",
  lat,
  lng,
  status: "high",
  precision: "ROOFTOP",
  source: "arquivo",
  url: "",
  notes: "",
  ...rest,
});
const distancePoint = (km: number) => ({ lat: -23 + ((km / EARTH_KM) * 180) / Math.PI, lng: -46 });
function file(rows: unknown[][]) {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet(rows), "Dados");
  return new Uint8Array(XLSX.write(b, { type: "array", bookType: "xlsx" }));
}
describe("Cruzamento 10 km isolado", () => {
  it("inclui dois hotéis por escritório sem escolher apenas nearest", () => {
    const r = calculate([p("hotel", "h1"), p("hotel", "h2", -23.01)], [p("office", "ESC-1")]);
    expect(r.pairs).toHaveLength(2);
    expect(r.officeSummary[0].count).toBe(2);
  });
  it("usa <=10 inclusive sem arredondar e faixas 0–3/3–10", () => {
    expect(band(3)).toBe("0–3 km");
    expect(band(3.00001)).toBe("3–10 km");
    expect(band(10)).toBe("3–10 km");
    expect(band(10.00000001)).toBe(">10 km");
    const o = p("office", "o");
    const in9 = distancePoint(9.999999),
      out = distancePoint(10.000001);
    const r = calculate([p("hotel", "inside", in9.lat), p("hotel", "outside", out.lat)], [o]);
    expect(r.pairs.map((v) => v.hotel.id)).toEqual(["inside"]);
    // Exact computed threshold without decimal presentation rounding.
    expect(haversine({ lat: -23, lng: -46 }, in9)).toBeLessThan(10);
  });
  it("não restringe cidade/UF", () => {
    const r = calculate(
      [p("hotel", "h", -23, -46, { city: "Barueri", uf: "RJ" })],
      [p("office", "o")],
    );
    expect(r.pairs).toHaveLength(1);
  });
  it("nearest global preserva distância >10 e zero no raio", () => {
    const r = calculate([p("hotel", "h")], [p("office", "far", -24), p("office", "near", -23.2)]);
    expect(r.hotelSummary[0].nearest?.code).toBe("near");
    expect(r.hotelSummary[0].km).toBeGreaterThan(10);
    expect(r.hotelSummary[0].count).toBe(0);
    expect(r.pairs).toHaveLength(0);
  });
  it("inclui review/aproximada e status error com coordenadas igualmente", () => {
    const r = calculate(
      [p("hotel", "review", -23, -46, { status: "review", precision: "aproximada" })],
      [p("office", "o", -23, -46, { status: "error", precision: "municipal" })],
    );
    expect(r.pairs).toHaveLength(1);
    expect(r.audit.some((a) => a.precision === "municipal")).toBe(true);
  });
  it("exclui ausentes/não numéricas/16/16/fora Brasil e preserva resumos", () => {
    for (const c of [
      { lat: "", lng: -46 },
      { lat: null, lng: -46 },
      { lat: "NaN", lng: -46 },
      { lat: 16, lng: 16 },
      { lat: Infinity, lng: -46 },
      { lat: 0, lng: 0 },
      { lat: -35, lng: -46 },
    ])
      expect(coords(c)).toBeNull();
    expect(coords({ lat: "-23,5", lng: "-46,5" })).toEqual({ lat: -23.5, lng: -46.5 });
    const r = calculate([p("hotel", "h", null)], [p("office", "o", null)]);
    expect(r.hotelSummary).toHaveLength(1);
    expect(r.officeSummary[0].count).toBe(0);
    expect(r.hotelSummary[0].km).toBeNull();
  });
  it("preenche por ESC/CNPJ string com zeros sem sobrescrever ou duplicar", () => {
    const base = [p("office", "ESC-0001", null, null), p("office", "ESC-0002")];
    const extra = [
      {
        code: "ESC-0001",
        lat: -23,
        lng: -46,
        precision: "aproximada",
        url: "https://fonte.example",
        notes: "ponto",
        source: "extra.xlsx",
      },
      {
        code: "ESC-0002",
        lat: -24,
        lng: -47,
        precision: "municipal",
        url: "",
        notes: "",
        source: "extra.xlsx",
      },
    ];
    const r = supplement(base, extra);
    expect(r.points).toHaveLength(2);
    expect(r.points[0].lat).toBe(-23);
    expect(r.points[0].precision).toBe("aproximada");
    expect(r.points[1].lat).toBe(-23);
    expect(base[0].lat).toBeNull();
    const h = supplement(
      [p("hotel", "00.123.456/0001-09", null, null)],
      [{ ...extra[0], code: "00123456000109" }],
    );
    expect(h.points[0].lat).toBe(-23);
    expect(h.points[0].code).toBe("00.123.456/0001-09");
  });
  it("não substitui nem coordenadas presentes inválidas; completa somente campo vazio", () => {
    const extra = {
      code: "o",
      lat: -23,
      lng: -46,
      precision: "aprox",
      url: "",
      notes: "",
      source: "sup",
    };
    expect(supplement([p("office", "o", 16, 16)], [extra]).points[0].lat).toBe(16);
    const r = supplement([p("office", "o", -22, null)], [extra]);
    expect(r.points[0].lat).toBe(-22);
    expect(r.points[0].lng).toBe(-46);
  });
  it("bloqueia duplicatas suplemento/fonte e coordenadas 16/16, audita desconhecidos", () => {
    const e = { code: "o", lat: -23, lng: -46, precision: "", url: "", notes: "", source: "sup" };
    expect(supplement([p("office", "o", null, null)], [e, e]).points[0].lat).toBeNull();
    expect(
      supplement([p("office", "o", null, null), p("office", "o", null, null)], [e]).audit[0].reason,
    ).toContain("ambíguo");
    expect(
      supplement([p("office", "o", null, null)], [{ ...e, lat: 16, lng: 16 }]).points[0].lat,
    ).toBeNull();
    expect(supplement([p("office", "x", null, null)], [e]).audit[0].reason).toContain(
      "sem entidade",
    );
  });
  it("lê A/H/I/J/N/O e preserva códigos, zeros e traço em XLSX/CSV", () => {
    const headers = [
      "Código",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "Latitude",
      "Longitude",
      "Tipo de localização",
      "K",
      "L",
      "M",
      "Fonte URL",
      "Observações",
    ];
    const r = parseSupplement(
      file([
        headers,
        [
          "ESC-0001",
          "",
          "",
          "",
          "",
          "",
          "",
          -23,
          -46,
          "Aproximado",
          "",
          "",
          "",
          "https://fonte.example",
          "nota",
        ],
      ]),
      "sup.xlsx",
    );
    expect(r[0]).toMatchObject({
      code: "ESC-0001",
      lat: "-23",
      lng: "-46",
      precision: "Aproximado",
      url: "https://fonte.example",
      notes: "nota",
    });
    expect(
      parseSupplement(
        new TextEncoder().encode("CNPJ;Latitude;Longitude\n00123456000109;-23;-46"),
        "sup.csv",
      )[0].code,
    ).toBe("00123456000109");
  });
  it("exporta quatro abas, todos pares, resumos inclusive zeros, auditoria e strings", () => {
    const r = calculate(
      [p("hotel", "00.123.456/0001-09"), p("hotel", "h2", null)],
      [p("office", "ESC-0001"), p("office", "ESC-0002", null)],
    );
    const b = exportWorkbook(r);
    expect(b.SheetNames).toEqual([
      "Pares ate 10km",
      "Escritorios resumo",
      "Hoteis resumo",
      "Auditoria",
    ]);
    expect(XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]])).toHaveLength(1);
    expect(XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[1]])).toHaveLength(2);
    expect(XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[2]])).toHaveLength(2);
    expect(JSON.stringify(XLSX.utils.sheet_to_json(b.Sheets["Hoteis resumo"]))).toContain(
      "00.123.456/0001-09",
    );
    expect(XLSX.utils.sheet_to_json(b.Sheets["Auditoria"])).toHaveLength(5);
  });
  it("393 × 666 cobre todas entidades sem truncamento com desempenho limitado", () => {
    const h = Array.from({ length: 393 }, (_, i) => p("hotel", `h${i}`));
    const o = Array.from({ length: 666 }, (_, i) => p("office", `o${i}`));
    const start = performance.now();
    const r = calculate(h, o);
    expect(r.pairs).toHaveLength(393 * 666);
    expect(r.hotelSummary.every((h) => h.count === 666)).toBe(true);
    expect(r.officeSummary.every((o) => o.count === 393)).toBe(true);
    expect(performance.now() - start).toBeLessThan(10000);
  });
});
