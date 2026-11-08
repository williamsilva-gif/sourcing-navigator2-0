import references from "./city-reference.json";
import {
  haversine,
  municipal,
  norm,
  originalNumber,
  similarName,
  stateCode,
  type Entity,
  type Geo,
} from "./core";

export type CatalogHotel = {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};
export type CatalogCandidate = {
  hotel: CatalogHotel;
  matchedFields: string[];
  reasons: string[];
  confidence: "high" | "review";
  invalid: boolean;
  reference?: string;
  distanceToCityKm?: number;
};
export type CatalogAudit = {
  status: "recovered" | "review" | "unmatched" | "invalid";
  checkedAt: string;
  candidates: CatalogCandidate[];
  selectedId?: string;
  reason?: string;
  actorId?: string;
};
const geoStates: Record<string, string> = {
  "01": "ac",
  "02": "al",
  "03": "ap",
  "04": "am",
  "05": "ba",
  "06": "ce",
  "07": "df",
  "08": "es",
  "29": "go",
  "13": "ma",
  "14": "mt",
  "11": "ms",
  "15": "mg",
  "16": "pa",
  "17": "pb",
  "18": "pr",
  "30": "pe",
  "20": "pi",
  "21": "rj",
  "22": "rn",
  "23": "rs",
  "24": "ro",
  "25": "rr",
  "26": "sc",
  "27": "sp",
  "28": "se",
  "31": "to",
};
export function postal(value: string) {
  const digits = value.replace(/\D/g, "");
  // Catalog spreadsheets sometimes lost exactly one leading zero; no other postal inference.
  return digits.length === 7 ? `0${digits}` : digits;
}
export function street(value: string) {
  return norm(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(av|avda)\.?\s/g, "avenida ")
      .replace(/\b(r)\.?\s/g, "rua ")
      .replace(/\b(dr)\.?\s/g, "doutor ")
      .replace(/\b(prof)\.?\s/g, "professor ")
      .replace(/\b(pca|pc)\.?\s/g, "praca "),
  );
}
export function addressParts(address: string, explicit = "") {
  const suffix = address.match(/(?:,\s*|\s+)(\d+[a-z]?)\b/i);
  return {
    street: street(suffix ? address.slice(0, suffix.index) : address),
    number: norm(explicit || suffix?.[1] || ""),
  };
}
export function geographicCheck(e: Entity, hotel: CatalogHotel) {
  const lat = hotel.latitude,
    lng = hotel.longitude;
  if (
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -34 ||
    lat > 6 ||
    lng < -74 ||
    lng > -34
  )
    return { invalid: true, reason: "Coordenadas inválidas/fora do Brasil" };
  const refs = references.filter(
    (r) =>
      geoStates[r.state] === stateCode(e.uf) &&
      [r.name, ...r.aliases].some((n) => norm(n) === municipal(e)),
  );
  if (refs.length !== 1)
    return { invalid: false, reason: "Referência municipal independente ausente/ambígua" };
  const ref = refs[0];
  const km = haversine({ lat, lng }, ref);
  // Conservative urban sanity bound, not a claim of cadastral/municipal polygon containment.
  return {
    invalid: km > 35,
    reason: km > 35 ? "Coordenadas incompatíveis com referência urbana (mais de 35 km)" : undefined,
    reference: `GeoNames ${ref.id} / cities15000 / CC BY 4.0`,
    distanceToCityKm: km,
  };
}
export function assessCatalog(e: Entity, h: CatalogHotel): CatalogCandidate {
  const fields: string[] = [],
    reasons: string[] = [];
  const match = (ok: boolean, field: string, reason: string) =>
    ok ? fields.push(field) : reasons.push(reason);
  match(similarName(e.name, h.name), "nome", "Nome incoerente");
  match(municipal(e) === norm(h.city), "municipio", "Município incoerente");
  if (h.state) match(stateCode(e.uf) === stateCode(h.state), "uf", "UF incoerente");
  const a = addressParts(e.address, originalNumber(e)),
    b = addressParts(h.address ?? "");
  match(!!a.street && a.street === b.street, "logradouro", "Logradouro divergente/ausente");
  match(!!a.number && a.number === b.number, "numero", "Número original ausente/divergente");
  if (e.cep || h.postal_code)
    match(
      postal(e.cep).length === 8 && postal(e.cep) === postal(h.postal_code ?? ""),
      "cep",
      "CEP físico ausente/divergente",
    );
  const geo = geographicCheck(e, h);
  if (geo.reason) reasons.push(geo.reason);
  else fields.push(h.state ? "referencia_geografica" : "uf_referencia_geografica");
  return {
    hotel: h,
    matchedFields: fields,
    reasons,
    confidence: reasons.length ? "review" : "high",
    invalid: geo.invalid,
    reference: geo.reference,
    distanceToCityKm: geo.distanceToCityKm,
  };
}
export function catalogAudit(e: Entity, rows: CatalogHotel[], truncated = false): CatalogAudit {
  const candidates = rows.map((h) => assessCatalog(e, h));
  const high = candidates.filter((c) => c.confidence === "high");
  return {
    status:
      !truncated && high.length === 1
        ? "recovered"
        : !candidates.length
          ? "unmatched"
          : candidates.every((c) => c.invalid)
            ? "invalid"
            : "review",
    checkedAt: new Date().toISOString(),
    candidates,
    selectedId: !truncated && high.length === 1 ? high[0].hotel.id : undefined,
    reason: truncated
      ? "Consulta limitada: revisão necessária"
      : high.length > 1
        ? "Múltiplas propriedades válidas: seleção humana necessária"
        : undefined,
  };
}
export function catalogGeo(candidate: CatalogCandidate): Geo | undefined {
  if (
    candidate.confidence !== "high" ||
    candidate.invalid ||
    candidate.hotel.latitude === null ||
    candidate.hotel.longitude === null
  )
    return undefined;
  return {
    lat: candidate.hotel.latitude,
    lng: candidate.hotel.longitude,
    confidence: "high",
    source: "Navigator Cadastro",
    formatted: candidate.hotel.address ?? undefined,
    reasons: [],
    checkedAt: new Date().toISOString(),
  };
}
// PostgREST ILIKE wildcard vowel positions handles accents without changing DB columns.
export function selectivePattern(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .replace(/[aeiou]/gi, "_");
}

export function catalogCandidates(e: Entity, rows: CatalogHotel[]) {
  const cep = postal(e.cep);
  const own = addressParts(e.address, originalNumber(e));
  const hits = rows.filter((h) => {
    if (norm(h.city) !== municipal(e)) return false;
    if (similarName(e.name, h.name)) return true;
    const other = addressParts(h.address ?? "");
    return cep.length === 8 && cep === postal(h.postal_code ?? "") && !!own.number && own.number === other.number;
  });
  return { rows: hits.slice(0, 20), truncated: hits.length > 20 };
}
