import type { GoogleResult, GooglePlace } from "../proximity/core";
import { stateCode } from "../proximity/core";
import { query, SheetJobFatal, type Row } from "./core";
import { selectGeocode, selectPoi, selectPostal, queryAddress, poiName, validPostal, type Selection } from "./selection";

export type SheetRequest = (path: string, init?: RequestInit) => Promise<unknown>;
async function geocode(request: SheetRequest, address: string): Promise<GoogleResult[]> {
  const response = await request(`/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=pt-BR&region=br`) as { status?: string; results?: GoogleResult[] };
  if (!response || typeof response.status !== "string") throw new Error("Resposta Google malformada: status ausente.");
  if (["REQUEST_DENIED", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"].includes(response.status)) throw new SheetJobFatal(`Google ${response.status}: verifique autorização ou quota antes de retomar.`);
  if (response.status === "UNKNOWN_ERROR") throw new Error("Google transiente UNKNOWN_ERROR");
  if (!["OK", "ZERO_RESULTS"].includes(response.status)) throw new Error(`Google ${response.status}: consulta não resolvida`);
  if (response.results !== undefined && !Array.isArray(response.results)) throw new Error("Resposta Google malformada: resultados inválidos.");
  return response.results ?? [];
}
// Caller owns durable reservation/auth/lease. At most 4 calls/attempt; stop as soon as real coordinates exist.
export async function resolveUnit(row: Row, request: SheetRequest): Promise<Selection | undefined> {
  let selection = selectGeocode(row, await geocode(request, query(row)));
  if (selection) return selection;
  const address = queryAddress(row);
  if (row.entity.cep) {
    const withoutPostal = [address.street, address.number, row.district, row.entity.city, stateCode(row.entity.uf).toUpperCase(), "Brasil"].filter(Boolean).join(", ");
    selection = selectGeocode(row, await geocode(request, withoutPostal));
    if (selection) return selection;
  }
  const landmark = poiName(row);
  if (landmark) {
    const response = await request("/places/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents,places.businessStatus,nextPageToken" }, body: JSON.stringify({ textQuery: `${landmark}, ${row.entity.city}, ${stateCode(row.entity.uf).toUpperCase()}, Brasil`, languageCode: "pt-BR", regionCode: "BR", pageSize: 5 }) }) as { places?: GooglePlace[]; nextPageToken?: string };
    if (!response || (response.places !== undefined && !Array.isArray(response.places))) throw new Error("Resposta Places malformada.");
    selection = selectPoi(row, response.places ?? [], !!response.nextPageToken);
    if (selection) return selection;
  }
  if (validPostal(row.entity.cep)) {
    return selectPostal(row, await geocode(request, `${row.entity.cep}, ${row.entity.city}, ${stateCode(row.entity.uf).toUpperCase()}, Brasil`));
  }
  // No municipal fallback: do not substitute a city center for a named unit.
  return undefined;
}