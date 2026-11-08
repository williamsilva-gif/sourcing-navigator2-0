import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parse,
  suggest,
  workbook,
  sheetRows,
  targetCities,
  cityKey,
  compare,
  haversine,
  band,
  validateGeocode,
  addressKey,
  type Entity,
  type GoogleResult,
} from "../src/lib/proximity/core";
const table = [
  [
    "Nome",
    "Código",
    "Endereço",
    "Número",
    "Cidade",
    "UF",
    "CEP",
    "CNPJ",
    "RNs",
    "Block List",
    "Ativo",
  ],
  [
    "Hotel Alfa",
    "",
    "Rua Teste",
    "10",
    "Cidade Teste",
    "SP",
    "01234-567",
    "00123456000199",
    "100",
    "Sim",
    "Sim",
  ],
  ["Hotel Beta", "", "Rua Teste", "20", "Cidade Teste", "SP", "01234-567", "", "0", "Não", "Sim"],
];
const fixture = () => {
  const hotels = parse(table, 1, suggest(table[0]), "hotel", "SINTÉTICO.xlsx", "Hotéis");
  const unit = (code: string, kind: "office" | "store", lng: number): Entity => ({
    ...hotels[0],
    id: crypto.randomUUID(),
    name: code,
    kind,
    code,
    rn: null,
    block: false,
    geo: {
      lat: -23,
      lng,
      confidence: "high",
      source: "SYNTHETIC TEST ONLY",
      reasons: [],
      checkedAt: "2026-11-08",
    },
  });
  hotels.forEach(
    (e, i) =>
      (e.geo = {
        lat: -23,
        lng: -46 + i * 0.01,
        confidence: "high",
        source: "SYNTHETIC TEST ONLY",
        reasons: [],
        checkedAt: "2026-11-08",
      }),
  );
  return [
    ...hotels,
    unit("ESC-1", "office", -46.01),
    unit("ESC-2", "office", -46.02),
    unit("ESC-3", "office", -46.03),
    unit("L1", "store", -46.04),
  ];
};
const googleResult = (): GoogleResult => ({
  geometry: { location: { lat: -23, lng: -46 }, location_type: "ROOFTOP" },
  address_components: [
    { long_name: "Cidade Teste", short_name: "Cidade Teste", types: ["locality"] },
    { long_name: "São Paulo", short_name: "SP", types: ["administrative_area_level_1"] },
    { long_name: "01234-567", short_name: "01234-567", types: ["postal_code"] },
    { long_name: "Brasil", short_name: "BR", types: ["country"] },
    { long_name: "10", short_name: "10", types: ["street_number"] },
  ],
});
describe("Raio & Proximidade isolated conservative rules", () => {
  it("reads actual workbook tabs and preserves CEP/CNPJ leading zero and originals", () => {
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(table), "397 hotéis - seleção");
    const bytes = XLSX.write(w, { type: "array", bookType: "xlsx" });
    const r = workbook(new Uint8Array(bytes));
    expect(r.SheetNames).toEqual(["397 hotéis - seleção"]);
    const e = parse(
      sheetRows(r, r.SheetNames[0]),
      1,
      suggest(table[0]),
      "hotel",
      "SINTÉTICO.xlsx",
      r.SheetNames[0],
    )[0];
    expect(e.cep).toBe("01234-567");
    expect(e.document).toBe("00123456000199");
    expect(e.original["H — CNPJ"]).toBe("00123456000199");
  });
  it("includes exactly 100 RNs", () => {
    const e = fixture();
    expect(targetCities(e).has(cityKey(e[0]))).toBe(true);
    e[0].rn = 99;
    expect(targetCities(e).has(cityKey(e[0]))).toBe(false);
  });
  it("Ibis is outside universe but Block List never excludes hotel", () => {
    const rows = [
      ...table,
      [
        "Ibis Teste",
        "",
        "Rua Teste",
        "30",
        "Cidade Teste",
        "SP",
        "01234-567",
        "",
        "100",
        "Sim",
        "Sim",
      ],
    ];
    const e = parse(rows, 1, suggest(rows[0]), "hotel", "SINTÉTICO.xlsx", "Hotéis");
    expect(e[0].block).toBe(true);
    expect(e[0].eligible).toBe(true);
    expect(e[2].eligible).toBe(false);
  });
  it("preserves ESC-* and L* and rejects duplicate unit codes without dropping originals", () => {
    const rows = [
      table[0],
      [
        "Escritório",
        "ESC-801",
        "Rua Teste",
        "10",
        "Cidade Teste",
        "SP",
        "01234-567",
        "",
        "",
        "",
        "",
      ],
      ["Outro", "ESC-801", "Rua Teste", "20", "Cidade Teste", "SP", "01234-567", "", "", "", ""],
    ];
    const e = parse(rows, 1, suggest(rows[0]), "office", "SINTÉTICO.xlsx", "Escritórios");
    expect(e.map((x) => x.code)).toEqual(["ESC-801", "ESC-801"]);
    expect(e.every((x) => !x.active && x.issues.includes("Código duplicado"))).toBe(true);
  });
  it("historical units are not active", () => {
    const rows = [
      table[0],
      [
        "Unidade",
        "801",
        "Rua Teste",
        "10",
        "Cidade Teste",
        "SP",
        "01234-567",
        "",
        "",
        "",
        "Histórico",
      ],
    ];
    expect(parse(rows, 1, suggest(rows[0]), "office", "SINTÉTICO.xlsx", "Unidade")[0].active).toBe(
      false,
    );
  });
  it("Santo Amaro is São Paulo only with explicit São Paulo address", () => {
    expect(cityKey({ city: "Santo Amaro", uf: "SP", address: "Rua Teste, São Paulo" })).toBe(
      "saopaulo:sp",
    );
    expect(cityKey({ city: "Santo Amaro", uf: "BA", address: "Rua Teste" })).toBe("santoamaro:ba");
  });
  it("deduplicates physical addresses including property CEP", () => {
    const e = fixture();
    const b = { ...e[0], name: "Outro", document: "123" };
    expect(addressKey(b)).toBe(addressKey(e[0]));
    b.cep = "99999-999";
    expect(addressKey(b)).not.toBe(addressKey(e[0]));
  });
  it("creates 8 auditable same-city pairs for 2 hotels / 3 offices / 1 store", () => {
    const pairs = compare(fixture());
    expect(pairs).toHaveLength(8);
    expect(pairs.filter((p) => p.nearest)).toHaveLength(4);
    expect(pairs.every((p) => p.definitive && !p.cross)).toBe(true);
  });
  it("missing one office makes office nearest provisional but store stays definitive", () => {
    const e = fixture();
    e[3].geo = undefined;
    const p = compare(e);
    expect(p.filter((x) => x.kind === "office").every((x) => !x.definitive)).toBe(true);
    expect(p.filter((x) => x.kind === "store").every((x) => x.definitive)).toBe(true);
    expect(p.filter((x) => x.kind === "office" && x.nearest)).toHaveLength(2);
  });
  it("does not default to cross municipality; explicit fallback remains provisional", () => {
    const e = fixture();
    e.filter((x) => x.kind === "office").forEach((x) => (x.city = "Outro Município"));
    expect(compare(e).some((p) => p.kind === "office")).toBe(false);
    expect(
      compare(e, true)
        .filter((p) => p.kind === "office")
        .every((p) => p.cross && !p.definitive),
    ).toBe(true);
  });
  it("keeps radius bands 0–3, 3–10 and >10 with exact boundaries", () => {
    expect(band(3)).toBe("0–3 km");
    expect(band(3.001)).toBe("3–10 km");
    expect(band(10)).toBe("3–10 km");
    expect(band(10.001)).toBe(">10 km");
    expect(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 3);
  });
  it("flags candidates within 100m of 3km", () => {
    const e = fixture();
    if (!e[0].geo || !e[2].geo) throw new Error("Fixture inválida");
    e[0].geo = { ...e[0].geo, lat: 0, lng: 0 };
    e[2].geo = { ...e[2].geo, lat: 0, lng: 3 / 111.195 };
    expect(compare(e).find((p) => p.hotelId === e[0].id && p.unitId === e[2].id)?.boundary).toBe(
      true,
    );
  });
  it("validates locality, UF, property postal code and precision", () => {
    const good = googleResult();
    good.address_components?.push({
      long_name: "Rua Teste",
      short_name: "Rua Teste",
      types: ["route"],
    });
    expect(validateGeocode(fixture()[0], good).confidence).toBe("high");
    const r = googleResult();
    r.address_components?.splice(0, 1, {
      long_name: "Brasília",
      short_name: "Brasília",
      types: ["locality"],
    });
    expect(validateGeocode(fixture()[0], r).confidence).toBe("review");
  });
  for (const type of ["UNKNOWN", "GEOMETRIC_CENTER", "APPROXIMATE"])
    it(`${type} is never high confidence`, () => {
      const r = googleResult();
      r.geometry.location_type = type;
      expect(validateGeocode(fixture()[0], r).confidence).toBe("review");
    });
  it("partial_match never high confidence", () => {
    const r = googleResult();
    r.partial_match = true;
    expect(validateGeocode(fixture()[0], r).confidence).toBe("review");
  });
  it("incorrect property CEP is review, not replaced", () => {
    const e = fixture()[0];
    const r = googleResult();
    const cep = r.address_components?.find((c) => c.types.includes("postal_code"));
    if (cep) cep.long_name = "70000-000";
    expect(validateGeocode(e, r).reasons).toContain("CEP incoerente/ausente");
    expect(e.cep).toBe("01234-567");
  });
  it("wrong house number and missing street never confer high confidence", () => {
    const r = googleResult();
    const n = r.address_components?.find((c) => c.types.includes("street_number"));
    if (n) n.long_name = "999";
    const result = validateGeocode(fixture()[0], r);
    expect(result.reasons).toContain("Número incoerente");
    expect(result.reasons).toContain("Logradouro não confirmado");
  });
  it("unresolved duplicate code keeps nearest provisional", () => {
    const e = fixture();
    e[3].active = false;
    e[3].issues = ["Código duplicado"];
    expect(
      compare(e)
        .filter((p) => p.kind === "office")
        .every((p) => !p.definitive),
    ).toBe(true);
  });
});
