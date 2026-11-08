import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseSheet,
  suggest,
  query,
  validate,
  enrich,
  counts,
  cacheKey,
  retryAt,
  readWorkbook,
} from "../src/lib/sheetGeolocation/core";
import type { GoogleResult } from "../src/lib/proximity/core";
const headers = [
  "Logradouro",
  "Número",
  "Bairro",
  "Cidade",
  "CEP",
  "Complemento",
  "Estado",
  "CPF original",
  "Valor",
];
function fixture() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      headers,
      [
        "Rua Teste",
        "10",
        "Centro",
        "Cidade Teste",
        "01234-567",
        "Sala 2",
        "São Paulo",
        "00123456789",
        12.5,
      ],
      [],
      ["Rua Teste", "", "Centro", "Cidade Teste", "01234-567", "Sala 10", "SP", "", 0],
    ]),
    "Escritórios",
  );
  return book;
}
const parse = () =>
  parseSheet(fixture(), "Escritórios", 1, suggest(headers), "office", "SINTÉTICO.xlsx");
const result = (): GoogleResult => ({
  place_id: "synthetic-place",
  geometry: { location: { lat: -23, lng: -46 }, location_type: "ROOFTOP" },
  address_components: [
    { types: ["locality"], long_name: "Cidade Teste", short_name: "Cidade Teste" },
    { types: ["administrative_area_level_1"], long_name: "São Paulo", short_name: "SP" },
    { types: ["country"], long_name: "Brasil", short_name: "BR" },
    { types: ["postal_code"], long_name: "01234-567", short_name: "01234-567" },
    { types: ["street_number"], long_name: "10", short_name: "10" },
    { types: ["route"], long_name: "Rua Teste", short_name: "Rua Teste" },
  ],
});
describe("Independent spreadsheet geolocation", () => {
  it("preserves CSV spelling and leading-zero identifiers as text", () => {
    const book = readWorkbook(
      new TextEncoder().encode(
        "Logradouro,Número,Cidade,UF,CEP,CPF\nRua Teste,10,Cidade Teste,SP,01234567,00123456789\n",
      ),
    );
    const ws = book.Sheets[book.SheetNames[0]];
    expect(ws.E2.v).toBe("01234567");
    expect(ws.F2.v).toBe("00123456789");
    expect(ws.B2.v).toBe("10");
  });
  it("backs off 429/5xx and stops after three attempts without retrying authorization failures", () => {
    expect(retryAt("Google HTTP 429", 1, 1000)).toBe(3000);
    expect(retryAt("Google HTTP 503", 2, 1000)).toBe(5000);
    expect(retryAt("Google HTTP 503", 3, 1000)).toBeUndefined();
    expect(retryAt("Google 403", 1, 1000)).toBeUndefined();
  });
  it("accepts unnamed offices and retains every row including blank rows", () => {
    const rows = parse();
    expect(rows).toHaveLength(3);
    expect(rows[0].entity.name).toBe("");
    expect(rows[1].index).toBe(2);
    expect(rows[2].entity.number).toBe("");
  });
  it("appends results without changing original cells/types/order or other sheets", () => {
    const book = fixture();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Original"], [123]]), "Outra");
    const before = JSON.stringify(book.Sheets);
    const rows = parse();
    enrich(book, "Escritórios", 1, rows);
    const round = XLSX.read(XLSX.write(book, { type: "array", bookType: "xlsx" }), {
      type: "array",
    });
    expect(round.Sheets.Escritorios).toBeUndefined();
    const ws = round.Sheets["Escritórios"];
    expect(ws.H2.v).toBe("00123456789");
    expect(ws.I2.v).toBe(12.5);
    expect(ws.I2.t).toBe("n");
    expect(ws.B4.v).toBe("");
    expect(ws.J1.v).toBe("Latitude");
    expect(ws.L3.v).toBe("pending");
    expect(round.Sheets.Outra.A2.v).toBe(123);
    expect(before).not.toBe(JSON.stringify(book.Sheets));
  });
  it("uses Brasil and complement without inventing the source number", () => {
    const row = parse()[2];
    expect(query(row)).toContain("Brasil");
    expect(query(row)).toContain("Sala 10");
    expect(row.entity.number).toBe("");
    expect(validate(row, result()).confidence).toBe("review");
  });
  it("accepts only consistent ROOFTOP coordinates as high", () => {
    expect(validate(parse()[0], result()).confidence).toBe("high");
  });
  it.each(["APPROXIMATE", "GEOMETRIC_CENTER", "RANGE_INTERPOLATED"])(
    "keeps %s under review",
    (precision) => {
      const r = result();
      r.geometry.location_type = precision;
      expect(validate(parse()[0], r).confidence).toBe("review");
    },
  );
  it.each(["locality", "administrative_area_level_1", "postal_code", "street_number"])(
    "rejects conflicting %s",
    (field) => {
      const r = result();
      const c = r.address_components?.find((c) => c.types.includes(field));
      if (c) {
        c.long_name = "Divergente";
        c.short_name = "XX";
      }
      expect(validate(parse()[0], r).confidence).toBe("review");
    },
  );
  it("does not report pending/review/errors as verified", () => {
    const rows = parse();
    rows[0].status = "high";
    rows[1].status = "review";
    expect(counts(rows)).toEqual({ total: 3, high: 1, review: 1, error: 0, pending: 1 });
  });
  it("deduplicates only identical address and hotel identity", () => {
    const rows = parse();
    expect(cacheKey(rows[0])).not.toBe(cacheKey(rows[2]));
    const other = structuredClone(rows[0]);
    other.entity.name = "Outro hotel";
    expect(cacheKey(other)).not.toBe(cacheKey(rows[0]));
  });
  it("requires mapped address city and state but no hotel field", () => {
    expect(() =>
      parseSheet(fixture(), "Escritórios", 1, { city: 3, uf: 6 }, "office", "S.xlsx"),
    ).toThrow("Mapeie");
  });
});
