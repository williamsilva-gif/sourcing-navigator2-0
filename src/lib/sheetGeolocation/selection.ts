import { norm, stateCode, municipal, type GoogleResult, type GooglePlace, type Geo } from "../proximity/core";
import type { Row } from "./core";

export const validPostal = (v: string) => /^(?:\d{8}|\d{5}-\d{3})$/.test(v.trim());
export function queryAddress(row: Row) {
  const address = row.entity.address;
  const match = address.match(/(?:\/\s*|,\s*|\s+n[º°o.]?\s*)(\d+[a-z]?)\b/i);
  return { street: match ? address.slice(0, match.index).trim() : address, number: row.entity.number || match?.[1] || "" };
}
const routeKey = (value: string) => norm(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(av|aven|avda)\.?\s/g, "avenida ").replace(/\br\.?\s/g, "rua ").replace(/\b(al|alam)\.?\s/g, "alameda ").replace(/\b(rod)\.?\s/g, "rodovia "));
function cityMatches(row: Row, city: string) {
  const expected = municipal(row.entity);
  const actual = norm(city);
  return actual === expected || (stateCode(row.entity.uf) === "df" && ["brasilia", "distritofederal", "df"].includes(expected) && ["brasilia", "distritofederal"].includes(actual));
}
export type Selection = { geo: Geo; precision: string; score: number; exact: boolean };
function candidate(row: Row, result: GoogleResult): Selection | undefined {
  const location = result?.geometry?.location;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180 || (location.lat === 0 && location.lng === 0)) return;
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const c = (type: string) => components.find(v => Array.isArray(v?.types) && v.types.includes(type));
  if (c("country")?.short_name !== "BR" || stateCode(c("administrative_area_level_1")?.short_name ?? "") !== stateCode(row.entity.uf)) return;
  if (!cityMatches(row, c("locality")?.long_name ?? c("administrative_area_level_2")?.long_name ?? "")) return;
  const expected = queryAddress(row);
  const route = routeKey(c("route")?.long_name ?? "");
  const street = routeKey(expected.street);
  const streetMatch = !!route && route === street;
  const number = c("street_number")?.long_name ?? "";
  const numberMatch = !!expected.number && norm(number) === norm(expected.number);
  // Another numbered property is not this unit, even when its postal code agrees.
  if (expected.number && number && !numberMatch) return;
  if (route && !streetMatch) return;
  const postal = c("postal_code")?.long_name ?? "";
  const postalMatch = validPostal(postal) && validPostal(row.entity.cep) && norm(postal) === norm(row.entity.cep);
  if (!streetMatch && !postalMatch) return;
  const precision = result.geometry.location_type || "UNKNOWN";
  const exact = streetMatch && numberMatch && precision === "ROOFTOP" && !result.partial_match && !!result.place_id;
  const reasons: string[] = [];
  if (!exact) reasons.push("Localização APROXIMADA — não serve para distância definitiva");
  if (result.partial_match) reasons.push("Correspondência parcial Google");
  if (!result.place_id) reasons.push("Place ID ausente");
  if (row.entity.cep && !postalMatch) reasons.push("CEP original divergente/ inválido ou CEP Google ausente; usado apenas como apoio");
  return { score: (numberMatch ? 100 : 0) + (streetMatch ? 60 : 0) + (precision === "ROOFTOP" ? 30 : 0) + (postalMatch ? 5 : 0), exact,
    precision: exact ? precision : `APROXIMADA · ${precision}`,
    geo: { ...location, confidence: exact ? "high" : "review", source: "Google Geocoding", placeId: result.place_id, formatted: result.formatted_address, derivedNumber: number, derivedPostalCode: postal, reasons, checkedAt: new Date().toISOString() } };
}
export function selectGeocode(row: Row, results: GoogleResult[]): Selection | undefined {
  const candidates = results.map(r => candidate(row, r)).filter((v): v is Selection => !!v)
    .sort((a, b) => b.score - a.score || (a.geo.placeId ?? "").localeCompare(b.geo.placeId ?? "") || a.geo.lat - b.geo.lat || a.geo.lng - b.geo.lng);
  const best = candidates[0];
  if (!best) return;
  const competing = candidates.slice(1).some(v => best.score - v.score < 25 && (v.geo.placeId !== best.geo.placeId || v.geo.lat !== best.geo.lat || v.geo.lng !== best.geo.lng));
  if (competing) {
    best.geo.confidence = "review";
    best.geo.reasons.push("Melhor candidato Google; múltiplas correspondências, confirmar");
    best.precision = `${best.precision} · candidato não aprovado para distância definitiva`;
  }
  return best;
}
export function poiName(row: Row) {
  const value = row.entity.name || queryAddress(row).street;
  // A generic street without a named landmark is not an establishment identity.
  return row.entity.name || /\b(aeroporto|aerodromo|terminal|shopping|hospital|universidade|estacao|porto|centro\s+(?:empresarial|comercial|de\s+convencoes))\b/i.test(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? value : "";
}
export function selectPoi(row: Row, places: GooglePlace[], truncated = false): Selection | undefined {
  const name = norm(poiName(row));
  if (!name) return;
  const matches = places.filter(p => norm(p.displayName?.text ?? "") === name && p.id && p.formattedAddress && !p.businessStatus?.startsWith("CLOSED"));
  for (const place of matches) {
    const components = place.addressComponents?.map(c => ({ long_name: c.longText, short_name: c.shortText, types: c.types }));
    const result: GoogleResult = { geometry: { location: { lat: place.location?.latitude ?? NaN, lng: place.location?.longitude ?? NaN }, location_type: "POI" }, address_components: components, place_id: place.id, formatted_address: place.formattedAddress };
    // Reuse geographic gates only; the named POI legitimately has no street number.
    const proxy = { ...row, entity: { ...row.entity, address: components?.find(c => c.types?.includes("route"))?.long_name || "", number: "", cep: components?.find(c => c.types?.includes("postal_code"))?.long_name || "" } };
    const selected = candidate(proxy, result);
    if (!selected) continue;
    selected.precision = "Ponto de interesse Google — localização física, não endereço numerado";
    selected.geo.source = "Google Places Text Search (New)";
    selected.geo.confidence = "review";
    selected.geo.reasons = ["POI identificado pelo nome/município/UF; não comprova o endereço da unidade nem distância definitiva", ...(matches.length > 1 || truncated ? ["Múltiplos POIs; confirmar referência"] : [])];
    return selected;
  }
}