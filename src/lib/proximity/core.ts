import * as XLSX from "xlsx";
export type Kind = "hotel" | "office" | "store";
export type Geo = {
  lat: number;
  lng: number;
  confidence: "high" | "review";
  source: string;
  placeId?: string;
  formatted?: string;
  confirmation?: "establishment";
  derivedNumber?: string;
  derivedPostalCode?: string;
  reasons: string[];
  checkedAt: string;
};
export type Entity = {
  id: string;
  kind: Kind;
  name: string;
  code: string;
  address: string;
  number: string;
  city: string;
  uf: string;
  cep: string;
  document: string;
  rn: number | null;
  block: boolean;
  active: boolean;
  eligible: boolean;
  original: Record<string, string>;
  source: { filename: string; sheet: string; row: number };
  issues: string[];
  geo?: Geo;
  attempted?: boolean;
  attempts?: number;
  nextRetry?: number;
  lastAttemptError?: string;
  catalog?: import("./catalog").CatalogAudit;
};
export type Pair = {
  hotelId: string;
  unitId: string;
  kind: Kind;
  km: number;
  band: string;
  definitive: boolean;
  nearest: boolean;
  boundary: boolean;
  cross: boolean;
  roadKm?: number;
  roadSource?: string;
  /** Coordinate of hotel or unit is still under TA review: indicative only, never definitive. */
  reviewGeo?: boolean;
};
export const fields = {
  name: "Nome",
  code: "Código",
  address: "Endereço físico",
  number: "Número",
  city: "Cidade",
  uf: "UF",
  cep: "CEP do imóvel",
  document: "CPF/CNPJ original",
  rn: "RNs totais da cidade",
  block: "Block List",
  active: "Ativo / histórico",
};
export type Mapping = Partial<Record<keyof typeof fields, number>>;
export const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function stateCode(value: string) {
  const names: Record<string, string> = {
    acre: "ac",
    alagoas: "al",
    amapa: "ap",
    amazonas: "am",
    bahia: "ba",
    ceara: "ce",
    distritofederal: "df",
    espiritosanto: "es",
    goias: "go",
    maranhao: "ma",
    matogrosso: "mt",
    matogrossodosul: "ms",
    minasgerais: "mg",
    para: "pa",
    paraiba: "pb",
    parana: "pr",
    pernambuco: "pe",
    piaui: "pi",
    riodejaneiro: "rj",
    riograndedonorte: "rn",
    riograndedosul: "rs",
    rondonia: "ro",
    roraima: "rr",
    santacatarina: "sc",
    saopaulo: "sp",
    sergipe: "se",
    tocantins: "to",
  };
  return names[norm(value)] ?? norm(value);
}
export function municipal(e: Pick<Entity, "city" | "uf" | "address">) {
  return norm(e.city) === "santoamaro" &&
    stateCode(e.uf) === "sp" &&
    /sao\s*paulo/i.test(e.address.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    ? "saopaulo"
    : norm(e.city);
}
export function cityKey(e: Pick<Entity, "city" | "uf" | "address">) {
  return `${municipal(e)}:${stateCode(e.uf)}`;
}
export function addressKey(e: Entity) {
  return [norm(e.address), norm(e.number), cityKey(e), e.cep.replace(/\D/g, "")].join("|");
}
export function originalNumber(e: Entity) {
  // Only an explicit field or an address suffix after a comma: street names can contain digits.
  return e.number || e.address.match(/,\s*(\d+[a-z]?)\b/i)?.[1] || "";
}
export function lookupKey(e: Entity) {
  return `${addressKey(e)}|${e.kind}|${norm(e.name)}|${norm(e.code)}`;
}
export function workbook(bytes: Uint8Array) {
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Limite 10 MB.");
  return XLSX.read(bytes, { type: "array", cellText: true });
}
export function sheetRows(w: XLSX.WorkBook, sheet: string): string[][] {
  if (!w.Sheets[sheet]) throw new Error("Aba não encontrada.");
  return XLSX.utils.sheet_to_json(w.Sheets[sheet], { header: 1, raw: false, defval: "" });
}
export function suggest(headers: string[]): Mapping {
  const aliases: Record<keyof typeof fields, string[]> = {
    name: ["nome", "hotel", "nomefantasia", "unidadenome"],
    code: ["codigo", "codigounidade", "unidade"],
    address: ["endereco", "enderecocompleto", "logradouro"],
    number: ["numero", "num", "n"],
    city: ["cidade", "municipio", "cidades"],
    uf: ["uf", "estado"],
    cep: ["cep", "cepimovel"],
    document: ["cnpj", "cpf", "cpfcnpj"],
    rn: ["rns", "roomnights", "diarias"],
    block: ["blocklist", "bloqueado"],
    active: ["ativo", "statusunidade", "situacao"],
  };
  return Object.fromEntries(
    Object.entries(aliases).flatMap(([k, a]) => {
      const i = headers.findIndex((h) => a.includes(norm(h)));
      return i < 0 ? [] : [[k, i]];
    }),
  );
}
export function parse(
  rows: string[][],
  headerRow: number,
  mapping: Mapping,
  kind: Kind,
  filename: string,
  sheet: string,
): Entity[] {
  const headers = rows[headerRow - 1] ?? [];
  const entities = rows.slice(headerRow).flatMap((row, i) => {
    if (!row.some((v) => String(v).trim())) return [];
    const value = (f: keyof Mapping) =>
      mapping[f] === undefined ? "" : String(row[mapping[f] ?? 0] ?? "").trim();
    const rn = value("rn") ? Number(value("rn").replace(/\./g, "").replace(",", ".")) : null;
    const e: Entity = {
      id: crypto.randomUUID(),
      kind,
      name: value("name"),
      code: value("code"),
      address: value("address"),
      number: value("number"),
      city: value("city"),
      uf: value("uf"),
      cep: value("cep"),
      document: value("document"),
      rn: Number.isFinite(rn) ? rn : null,
      block: /^(sim|yes|true|1|bloqueado)$/i.test(value("block")),
      active: !/(histor|inativ|fechad)/i.test(norm(value("active"))),
      eligible: true,
      original: Object.fromEntries(
        row.map((v, c) => [`${XLSX.utils.encode_col(c)} — ${headers[c] ?? ""}`, String(v)]),
      ),
      source: { filename, sheet, row: headerRow + i + 1 },
      issues: [],
    };
    if (!e.name) e.issues.push("Nome ausente");
    if (!e.address || !originalNumber(e)) e.issues.push("Endereço físico ou número ausente");
    if (!e.city || !/^([a-z]{2})$/.test(stateCode(e.uf)))
      e.issues.push("Cidade/UF ausente ou inválida");
    if (e.cep.replace(/\D/g, "").length !== 8) e.issues.push("CEP inválido/ausente");
    if (kind !== "hotel" && !/^(ESC-[\w-]+|L[\w-]+|801)$/i.test(e.code))
      e.issues.push("Código de unidade ausente ou fora do padrão ESC-*, L*, 801");
    if (!e.active)
      e.issues.push("Histórico/inativo: exige confirmação por endereço para participar");
    if (kind === "hotel" && /\bibis\b/i.test(e.name)) {
      e.eligible = false;
      e.issues.push("Ibis fora do universo de seleção");
    }
    return [e];
  });
  const counts = new Map<string, number>();
  entities.filter((e) => e.code).forEach((e) => counts.set(e.code, (counts.get(e.code) ?? 0) + 1));
  entities.forEach((e) => {
    if (e.code && (counts.get(e.code) ?? 0) > 1) {
      e.issues.push("Código duplicado");
      e.active = false;
    }
  });
  return entities;
}
export function targetCities(entities: Entity[]) {
  const hotels = entities.filter((e) => e.kind === "hotel" && e.eligible);
  const hasRn = hotels.some((e) => e.rn !== null);
  const totals = new Map<string, Set<number>>();
  hotels.forEach((e) => {
    if (e.rn === null) return;
    const values = totals.get(cityKey(e)) ?? new Set<number>();
    values.add(e.rn);
    totals.set(cityKey(e), values);
  });
  return new Set(
    hotels
      .filter((e) => {
        const values = totals.get(cityKey(e));
        return !hasRn || (values?.size === 1 && [...values][0] >= 100);
      })
      .map(cityKey),
  );
}
export function inScope(e: Entity, entities: Entity[]) {
  return e.active && e.eligible && targetCities(entities).has(cityKey(e));
}
export function validGeo(e: Entity) {
  return e.geo?.confidence === "high" && Number.isFinite(e.geo.lat) && Number.isFinite(e.geo.lng);
}
// Review-grade coordinates feed provisional, clearly labeled distances only.
export function indicativeGeo(e: Entity) {
  return (
    validGeo(e) ||
    (e.geo?.confidence === "review" && Number.isFinite(e.geo.lat) && Number.isFinite(e.geo.lng))
  );
}
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const v =
    Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
}
export function band(km: number) {
  return km <= 3 ? "0–3 km" : km <= 10 ? "3–10 km" : ">10 km";
}
export type GoogleResult = {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  geometry: { location: { lat: number; lng: number }; location_type: string };
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
};
export function validateGeocode(e: Entity, r: GoogleResult): Geo {
  const c = (t: string) => r.address_components?.find((v) => v.types.includes(t));
  const locality = c("locality") ?? c("administrative_area_level_2");
  const reasons: string[] = [];
  if (!["ROOFTOP", "RANGE_INTERPOLATED"].includes(r.geometry.location_type))
    reasons.push(`Precisão ${r.geometry.location_type || "UNKNOWN"}`);
  if (r.partial_match) reasons.push("partial_match");
  if (!locality || norm(locality.long_name) !== municipal(e))
    reasons.push("Município incoerente/ausente");
  if (
    !c("administrative_area_level_1") ||
    stateCode(c("administrative_area_level_1")?.short_name ?? "") !== stateCode(e.uf)
  )
    reasons.push("UF incoerente/ausente");
  if (
    !c("postal_code") ||
    c("postal_code")?.long_name.replace(/\D/g, "") !== e.cep.replace(/\D/g, "")
  )
    reasons.push("CEP incoerente/ausente");
  if (!c("country") || c("country")?.short_name !== "BR") reasons.push("País incoerente/ausente");
  if (!c("street_number")) reasons.push("Número não confirmado");
  const expectedNumber = originalNumber(e);
  if (!expectedNumber) reasons.push("Número original ausente: confirmar estabelecimento");
  if (expectedNumber && norm(c("street_number")?.long_name ?? "") !== norm(expectedNumber))
    reasons.push("Número incoerente");
  if (!c("route")) reasons.push("Logradouro não confirmado");
  const route = norm(c("route")?.long_name ?? "");
  if (route && !norm(e.address).includes(route)) reasons.push("Logradouro incoerente");
  if (
    !Number.isFinite(r.geometry.location.lat) ||
    !Number.isFinite(r.geometry.location.lng) ||
    Math.abs(r.geometry.location.lat) > 90 ||
    Math.abs(r.geometry.location.lng) > 180
  )
    reasons.push("Coordenadas inválidas");
  if (!e.address) reasons.push("Endereço original incompleto");
  return {
    ...r.geometry.location,
    confidence: reasons.length ? "review" : "high",
    source: "Google Geocoding",
    placeId: r.place_id,
    formatted: r.formatted_address,
    reasons,
    checkedAt: new Date().toISOString(),
  };
}
export type GooglePlace = {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  businessStatus?: string;
  addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
};
export function similarName(a: string, b: string) {
  const tokens = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(
        (x) => x && !["hotel", "hoteis", "pousada", "inn", "de", "do", "da", "the"].includes(x),
      );
  const x = new Set(tokens(a)),
    y = new Set(tokens(b));
  if (!x.size || !y.size) return false;
  const common = [...x].filter((t) => y.has(t)).length;
  return common / Math.max(x.size, y.size) >= 0.8;
}
export function validatePlace(e: Entity, p: GooglePlace, ambiguous = false): Geo {
  const components = p.addressComponents?.map((c) => ({
    long_name: c.longText,
    short_name: c.shortText,
    types: c.types,
  }));
  const geo = validateGeocode(e, {
    place_id: p.id,
    formatted_address: p.formattedAddress,
    geometry: {
      location: { lat: p.location?.latitude ?? NaN, lng: p.location?.longitude ?? NaN },
      location_type: "ROOFTOP",
    },
    address_components: components,
  });
  // Places does not expose geocoding precision: confirmation rests on unique property identity and detailed physical address.
  geo.source = "Google Places Text Search / Place Details";
  geo.reasons = geo.reasons.filter(
    (r) => r !== "Número original ausente: confirmar estabelecimento",
  );
  if (!p.id || !p.formattedAddress)
    geo.reasons.push("Propriedade sem identidade/endereço detalhado");
  if (!similarName(e.name, p.displayName?.text ?? ""))
    geo.reasons.push("Nome do estabelecimento incoerente");
  if (e.kind === "hotel" && !p.types?.includes("lodging"))
    geo.reasons.push("Categoria lodging não confirmada");
  if (e.kind !== "hotel" && (!originalNumber(e) || !e.address || !e.code))
    geo.reasons.push("Identidade física da unidade requer revisão TA");
  if (p.businessStatus !== "OPERATIONAL") geo.reasons.push("Estabelecimento ativo não confirmado");
  if (ambiguous) geo.reasons.push("Nome/estabelecimento ambíguo: seleção humana necessária");
  geo.derivedNumber = components?.find((c) => c.types.includes("street_number"))?.long_name;
  geo.derivedPostalCode = components?.find((c) => c.types.includes("postal_code"))?.long_name;
  geo.confidence = geo.reasons.length ? "review" : "high";
  if (geo.confidence === "high") geo.confirmation = "establishment";
  return geo;
}
export function selectPlace(e: Entity, places: GooglePlace[], truncated = false) {
  const unique = [...new Map(places.filter((p) => p.id).map((p) => [p.id, p])).values()];
  const plausible = unique.filter((p) => similarName(e.name, p.displayName?.text ?? ""));
  const robust = plausible.filter((p) => validatePlace(e, p).confidence === "high");
  if (!truncated && robust.length === 1 && plausible.length === 1)
    return { place: robust[0], ambiguous: false };
  if (plausible.length === 1 && !truncated) return { place: plausible[0], ambiguous: false };
  return { place: undefined, ambiguous: plausible.length > 1 || truncated };
}
export function retryDelay(attempts: number) {
  return Math.min(60000, 2 ** attempts * 1000);
}
export function compare(entities: Entity[], allowCross = false): Pair[] {
  const pairs: Pair[] = [];
  for (const h of entities.filter(
    (e) => e.kind === "hotel" && inScope(e, entities) && indicativeGeo(e),
  )) {
    for (const kind of ["office", "store"] as const) {
      const local = entities.filter(
        (e) => e.kind === kind && e.active && e.eligible && cityKey(e) === cityKey(h),
      );
      const units = local.length
        ? local
        : allowCross
          ? entities.filter(
              (e) =>
                e.kind === kind && e.active && e.eligible && stateCode(e.uf) === stateCode(h.uf),
            )
          : [];
      const unresolvedCode = entities.some(
        (e) =>
          e.kind === kind && cityKey(e) === cityKey(h) && e.issues.includes("Código duplicado"),
      );
      const definite =
        validGeo(h) && local.length > 0 && units.every(validGeo) && !unresolvedCode;
      const candidates = units
        .filter(indicativeGeo)
        .flatMap((u) =>
          h.geo && u.geo
            ? [
                {
                  hotelId: h.id,
                  unitId: u.id,
                  kind,
                  km: haversine(h.geo, u.geo),
                  band: "",
                  definitive: definite,
                  reviewGeo: !validGeo(h) || !validGeo(u),
                  nearest: false,
                  boundary: false,
                  cross: cityKey(u) !== cityKey(h),
                },
              ]
            : [],
        )
        .sort((a, b) => a.km - b.km);
      candidates.forEach((p, i) =>
        pairs.push({
          ...p,
          band: band(p.km),
          nearest: i === 0,
          boundary: Math.abs(p.km - 3) <= 0.1 || Math.abs(p.km - 10) <= 0.1,
        }),
      );
    }
  }
  return pairs;
}
