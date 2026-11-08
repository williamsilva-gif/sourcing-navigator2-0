import { describe, it, expect } from "vitest";
import {
  assessCatalog,
  catalogAudit,
  catalogGeo,
  geographicCheck,
  postal,
  selectivePattern,
  type CatalogHotel,
} from "../src/lib/proximity/catalog";
import type { Entity } from "../src/lib/proximity/core";
const entity = (): Entity => ({
  id: "synthetic",
  kind: "hotel",
  name: "Hotel Alfa",
  code: "",
  address: "Av. Henri Teste",
  number: "792",
  city: "São Paulo",
  uf: "SP",
  cep: "04709-110",
  document: "",
  rn: 100,
  block: false,
  active: true,
  eligible: true,
  original: {},
  source: { filename: "SINTÉTICO", sheet: "test", row: 1 },
  issues: [],
});
const hotel = (): CatalogHotel => ({
  id: "catalog-synthetic",
  code: "SYNTHETIC",
  name: "Hotel Alfa",
  address: "Avenida Henri Teste 792 Bairro Teste",
  postal_code: "4709110",
  city: "Sao Paulo",
  state: null,
  latitude: -23.62767,
  longitude: -46.69896,
});
describe("catalog-first physical matching", () => {
  it("normalizes accent, avenue abbreviation, lost postal leading zero and geographic UF evidence", () => {
    const e = entity(),
      original = structuredClone(e);
    const c = assessCatalog(e, hotel());
    expect(c.confidence).toBe("high");
    expect(c.matchedFields).toContain("uf_referencia_geografica");
    expect(catalogGeo(c)?.source).toBe("Navigator Cadastro");
    expect(e).toEqual(original);
  });
  it("requires physical address even for identical name", () => {
    const h = hotel();
    h.address = "Rua Diferente 792";
    expect(assessCatalog(entity(), h).confidence).toBe("review");
  });
  it("divergent number never auto-confirms", () => {
    const h = hotel();
    h.address = "Avenida Henri Teste 999";
    expect(catalogGeo(assessCatalog(entity(), h))).toBeUndefined();
  });
  it("missing original number never borrows catalog number", () => {
    const e = entity();
    e.number = "";
    expect(assessCatalog(e, hotel()).confidence).toBe("review");
    expect(e.number).toBe("");
  });
  it("cross-city and explicit cross-state matches fail", () => {
    const h = hotel();
    h.city = "Belém";
    expect(assessCatalog(entity(), h).confidence).toBe("review");
    h.city = "Sao Paulo";
    h.state = "PA";
    expect(assessCatalog(entity(), h).confidence).toBe("review");
  });
  it("postal mismatch never confirms", () => {
    const h = hotel();
    h.postal_code = "66017-904";
    expect(assessCatalog(entity(), h).confidence).toBe("review");
  });
  it("rejects real reported out-of-Belém coordinate against independent municipality", () => {
    const e = entity();
    e.city = "Belém";
    e.uf = "PA";
    const h = hotel();
    h.latitude = -14.53467;
    h.longitude = -48.494056;
    expect(geographicCheck(e, h).invalid).toBe(true);
    expect(catalogGeo(assessCatalog(e, h))).toBeUndefined();
  });
  it("São Paulo coordinate examples pass urban plausibility, not address identity alone", () => {
    expect(geographicCheck(entity(), hotel()).invalid).toBe(false);
    const h = hotel();
    h.latitude = -23.62945;
    h.longitude = -46.70715;
    expect(geographicCheck(entity(), h).invalid).toBe(false);
  });
  it("unmatched and multiple valid candidates remain nonautomatic", () => {
    expect(catalogAudit(entity(), []).status).toBe("unmatched");
    const audit = catalogAudit(entity(), [hotel(), { ...hotel(), id: "other" }]);
    expect(audit.status).toBe("review");
    expect(audit.selectedId).toBeUndefined();
    expect(catalogAudit(entity(), [hotel()], true).status).toBe("review");
  });
  it("single robust match has audit identity and checked fields", () => {
    const a = catalogAudit(entity(), [hotel()]);
    expect(a.status).toBe("recovered");
    expect(a.selectedId).toBe("catalog-synthetic");
    expect(a.candidates[0].matchedFields).toContain("numero");
  });
  it("unknown municipality reference and null coordinates cannot confer HIGH", () => {
    const e = entity();
    e.city = "Município inexistente";
    expect(assessCatalog(e, hotel()).confidence).toBe("review");
    const h = hotel();
    h.latitude = null;
    expect(geographicCheck(entity(), h).invalid).toBe(true);
  });
  it("Santo Amaro normalizes only with explicit São Paulo address", () => {
    const e = entity();
    e.city = "Santo Amaro";
    e.address = "Av. Henri Teste, São Paulo";
    expect(geographicCheck(e, hotel()).invalid).toBe(false);
    e.address = "Av. Henri Teste";
    expect(geographicCheck(e, hotel()).reason).toBeTruthy();
  });
  it("selective patterns support diacritics without arbitrary filter operators", () => {
    expect(selectivePattern("Belém")).toBe("B_l_m");
    expect(selectivePattern("A%(),*")).toBe("_");
    expect(postal("4709110")).toBe("04709110");
  });
});
