import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseSheet, suggest, readWorkbook, enrich, query, type Row } from "../src/lib/sheetGeolocation/core";
import { selectGeocode, selectPoi, selectPostal } from "../src/lib/sheetGeolocation/selection";
import { resolveUnit } from "../src/lib/sheetGeolocation/resolve";
import type { GoogleResult, GooglePlace } from "../src/lib/proximity/core";

function fixture() {
  const book = readWorkbook(new TextEncoder().encode("Tipo,Código,Cidade,UF,Endereço original,Bairro,CEP original,CEP usado na localização,Latitude,Longitude,CNPJ\nEscritório,00063,São Paulo,SP,ALAMEDA SANTOS/745,Jardim Paulista,01419-001,99999-999,,,02.223.966/0090-99\n"));
  const sheet = book.SheetNames[0];
  const headers = XLSX.utils.sheet_to_json<string[]>(book.Sheets[sheet], { header: 1 })[0];
  return { book, sheet, headers, row: parseSheet(book, sheet, 1, suggest(headers), "office", "NOVO.csv")[0] };
}
function result(): GoogleResult {
  return { place_id: "mock-address", formatted_address: "Alameda Santos, 745, São Paulo, SP, Brasil", geometry: { location: { lat: -23.56, lng: -46.65 }, location_type: "ROOFTOP" }, address_components: [["country", "Brasil", "BR"], ["administrative_area_level_1", "São Paulo", "SP"], ["locality", "São Paulo", "São Paulo"], ["route", "Alameda Santos", "Alameda Santos"], ["street_number", "745", "745"], ["postal_code", "01419-001", "01419-001"]].map(([type,long_name,short_name]) => ({ types:[type],long_name,short_name })) };
}
function component(r: GoogleResult, type: string, value: string) {
  const c = r.address_components?.find(c => c.types.includes(type));
  if (c) { c.long_name = value; c.short_name = value; }
}
describe("New independent blank-coordinate imports (provider mocked only)", () => {
  it("auto maps original address/postal/code and uses slash number only for query", () => {
    const f = fixture();
    expect(suggest(f.headers)).toMatchObject({ address: 4, cep: 6, code: 1, city: 2, uf: 3, district: 5 });
    expect(f.row.entity.number).toBe("");
    expect(f.row.entity.address).toBe("ALAMEDA SANTOS/745");
    expect(query(f.row)).toContain("ALAMEDA SANTOS, 745");
    expect(f.row.entity.code).toBe("00063");
  });
  it("scores the exact numbered address above postal agreement and observes divergent CEP", () => {
    const f = fixture(); f.row.entity.cep = "99999-999";
    const street = result(); street.place_id = "mock-street"; street.geometry.location_type = "APPROXIMATE";
    street.address_components = street.address_components?.filter(c => !c.types.includes("street_number"));
    component(street,"postal_code","99999-999");
    const selected = selectGeocode(f.row, [street,result()]);
    expect(selected?.geo.placeId).toBe("mock-address");
    expect(selected?.geo.confidence).toBe("high");
    expect(selected?.geo.reasons.join(" ")).toContain("CEP original divergente");
  });
  it("keeps ambiguous real coordinates under review independent of provider order", () => {
    const other = result(); other.place_id = "other"; other.geometry.location.lat = -23.561;
    const a = selectGeocode(fixture().row,[result(),other]);
    const b = selectGeocode(fixture().row,[other,result()]);
    expect(a?.geo.lat).toBe(-23.56);
    expect(a?.geo.confidence).toBe("review");
    expect(a?.geo.reasons).toContain("Melhor candidato Google; múltiplas correspondências, confirmar");
    expect(a?.geo.placeId).toBe(b?.geo.placeId);
  });
  it.each([NaN, Infinity, 91])("rejects invalid latitude %s", lat => {
    const r = result(); r.geometry.location.lat = lat;
    expect(selectGeocode(fixture().row,[r])).toBeUndefined();
  });
  it("never accepts wrong state, country, city, number or street as the unit", () => {
    for (const [type,value] of [["administrative_area_level_1","RJ"],["country","US"],["locality","Campinas"],["street_number","746"],["route","Rua Outra"]]) {
      const r = result(); component(r,type,value);
      expect(selectGeocode(fixture().row,[r])).toBeUndefined();
    }
  });
  it("saves a street-only approximation and never approves it", () => {
    const r = result(); r.address_components = r.address_components?.filter(c => !c.types.includes("street_number"));
    r.geometry.location_type = "GEOMETRIC_CENTER";
    const selected = selectGeocode(fixture().row,[r]);
    expect(selected?.geo.lat).toBe(-23.56);
    expect(selected?.geo.confidence).toBe("review");
    expect(selected?.precision).toContain("APROXIMADA");
  });
  it("fills blank original coordinate columns, keeps identifiers/order and labels Google columns unambiguously", () => {
    const f = fixture(); f.row.geo = selectGeocode(f.row,[result()])?.geo;
    const before = structuredClone(f.book.Sheets[f.sheet]);
    enrich(f.book,f.sheet,1,[f.row]);
    const w = XLSX.read(XLSX.write(f.book,{type:"array",bookType:"xlsx"}),{type:"array"});
    const ws = w.Sheets[f.sheet];
    expect(ws.I2.v).toBe(-23.56); expect(ws.J2.v).toBe(-46.65);
    expect(ws.L1.v).toBe("Latitude Google"); expect(ws.M1.v).toBe("Longitude Google");
    for (const [address,cell] of Object.entries(before)) if (!address.startsWith("!") && !["I2","J2"].includes(address)) expect(ws[address].v).toEqual(cell.v);
    expect(ws.B2.v).toBe("00063"); expect(ws.K2.v).toBe("02.223.966/0090-99");
  });
  it("never overwrites nonempty coordinates, formulas or legacy original blanks", () => {
    const f = fixture(); f.row.geo = selectGeocode(f.row,[result()])?.geo;
    f.book.Sheets[f.sheet].I2 = {t:"s",v:"original-value"};
    f.book.Sheets[f.sheet].J2 = {t:"n",v:1,f:"1+0"};
    enrich(f.book,f.sheet,1,[f.row]);
    expect(f.book.Sheets[f.sheet].I2.v).toBe("original-value");
    expect(f.book.Sheets[f.sheet].J2.f).toBe("1+0");
    const legacy = fixture(); delete legacy.row.localizationVersion; legacy.row.geo=f.row.geo;
    enrich(legacy.book,legacy.sheet,1,[legacy.row]);
    expect(legacy.book.Sheets[legacy.sheet].I2?.v ?? "").toBe("");
  });
  it("extracts Nº from source without mutating the original address", () => {
    const row=fixture().row; row.entity.address="Alameda Santos Nº 745";
    expect(query(row)).toContain("Alameda Santos, 745");
    expect(row.entity.address).toBe("Alameda Santos Nº 745");
  });
  it("resolves named Brasília airport via Places without lodging filter or inventing a number", async () => {
    const row=fixture().row; row.entity.address="Aeroporto Internacional de Brasília"; row.entity.city="Brasília"; row.entity.uf="DF"; row.entity.cep="";
    const p: GooglePlace={id:"mock-airport",displayName:{text:row.entity.address},formattedAddress:"Aeroporto, Brasília, DF, Brasil",location:{latitude:-15.87,longitude:-47.92},types:["airport"],addressComponents:[{types:["country"],longText:"Brasil",shortText:"BR"},{types:["administrative_area_level_1"],longText:"Distrito Federal",shortText:"DF"},{types:["locality"],longText:"Distrito Federal",shortText:"DF"}]};
    const request=vi.fn().mockResolvedValueOnce({status:"ZERO_RESULTS",results:[]}).mockResolvedValueOnce({places:[p]});
    const selected=await resolveUnit(row,request);
    expect(selected?.geo.lat).toBe(-15.87); expect(selected?.geo.placeId).toBe("mock-airport");
    expect(selected?.geo.confidence).toBe("review"); expect(selected?.precision).toContain("Ponto de interesse");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe("/places/v1/places:searchText");
    expect(JSON.parse(request.mock.calls[1][1].body)).not.toHaveProperty("includedType");
    expect(row.entity.number).toBe("");
    p.displayName={text:"Outro Aeroporto"}; expect(selectPoi(row,[p])).toBeUndefined();
  });
  it("CEP-only fallback is a real postal centroid, never high or definitive", async () => {
    const row=fixture().row; const r=result(); r.address_components=r.address_components?.filter(c=> !c.types.includes("route") && !c.types.includes("street_number")); r.geometry.location_type="APPROXIMATE";
    const request=vi.fn().mockResolvedValueOnce({status:"ZERO_RESULTS"}).mockResolvedValueOnce({status:"ZERO_RESULTS"}).mockResolvedValueOnce({status:"OK",results:[r]});
    const selected=await resolveUnit(row,request);
    expect(request).toHaveBeenCalledTimes(3); expect(selected?.precision).toBe("Centroide CEP");
    expect(selected?.geo.confidence).toBe("review"); expect(selected?.geo.lat).toBe(-23.56);
    component(r,"administrative_area_level_1","RJ"); expect(selectPostal(row,[r])).toBeUndefined();
  });
  it("stops at first plausible response and never fabricates coordinates for empty sources", async () => {
    const request=vi.fn().mockResolvedValue({status:"OK",results:[result()]});
    expect((await resolveUnit(fixture().row,request))?.geo.lat).toBe(-23.56);
    expect(request).toHaveBeenCalledTimes(1);
    request.mockReset().mockResolvedValue({status:"ZERO_RESULTS"});
    expect(await resolveUnit(fixture().row,request)).toBeUndefined(); expect(request).toHaveBeenCalledTimes(3);
  });
  it("preserves fatal authorization and caller budget interrupts without retries", async () => {
    const request=vi.fn().mockResolvedValue({status:"REQUEST_DENIED"});
    await expect(resolveUnit(fixture().row,request)).rejects.toThrow("REQUEST_DENIED"); expect(request).toHaveBeenCalledTimes(1);
    const limited=vi.fn().mockResolvedValueOnce({status:"ZERO_RESULTS"}).mockRejectedValueOnce(new Error("Limite de consultas atingido"));
    await expect(resolveUnit(fixture().row,limited)).rejects.toThrow("Limite"); expect(limited).toHaveBeenCalledTimes(2);
  });
});