import type { Row } from "../sheetGeolocation/core";

export const EARTH_KM = 6371.0088; // Mean Earth radius; Haversine on WGS84 latitude/longitude.
export type Point = {
  id: string;
  kind: "hotel" | "office";
  name: string;
  code: string;
  address: string;
  number: string;
  city: string;
  uf: string;
  lat: unknown;
  lng: unknown;
  status: string;
  precision: string;
  source: string;
  url: string;
  notes: string;
};
export type Audit = {
  code: string;
  kind: string;
  reason: string;
  source: string;
  precision?: string;
  url?: string;
  notes?: string;
};
export type Supplement = {
  code: string;
  lat: unknown;
  lng: unknown;
  precision: string;
  url: string;
  notes: string;
  source: string;
};
export function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^-?\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const n = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export const absent = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());
export function coords(p: { lat: unknown; lng: unknown }): { lat: number; lng: number } | null {
  const lat = number(p.lat),
    lng = number(p.lng);
  if (
    lat === null ||
    lng === null ||
    lat < -34 ||
    lat > 6 ||
    lng < -74 ||
    lng > -30 ||
    (lat === 16 && lng === 16)
  )
    return null;
  return { lat, lng };
}
export function points(rows: Row[], kind: Point["kind"], filename: string): Point[] {
  return rows.map((r, i) => ({
    id: `${kind}-${i}`,
    kind,
    name: r.entity.name,
    code: String(r.entity.code ?? ""),
    address: r.entity.address,
    number: r.entity.number,
    city: r.entity.city,
    uf: r.entity.uf,
    lat: r.geo?.lat,
    lng: r.geo?.lng,
    status: r.status,
    precision: r.precision || r.geo?.confidence || r.status,
    source: r.geo?.source || filename,
    url: "",
    notes: [...r.notes, ...(r.geo?.reasons ?? [])].join("; "),
  }));
}
export function key(code: string, kind: Point["kind"]) {
  return kind === "hotel" ? code.replace(/[.\-/\s]/g, "") : code.trim().toUpperCase();
}
export function supplement(base: Point[], rows: Supplement[]) {
  const audit: Audit[] = [];
  const kind = base[0]?.kind ?? "office";
  const grouped = new Map<string, Supplement[]>();
  for (const row of rows) {
    const k = key(row.code, kind);
    grouped.set(k, [...(grouped.get(k) ?? []), row]);
  }
  const baseCounts = new Map<string, number>();
  base.forEach((p) =>
    baseCounts.set(key(p.code, kind), (baseCounts.get(key(p.code, kind)) ?? 0) + 1),
  );
  const additions = new Map<string, Supplement>();
  for (const [k, group] of grouped) {
    const r = group[0];
    if (!r) continue;
    let reason = "";
    if (!k) reason = "Código vazio";
    else if (group.length > 1) reason = "Código duplicado no suplemento: nenhuma aplicação";
    else if (!baseCounts.has(k)) reason = "Código sem entidade correspondente";
    else if ((baseCounts.get(k) ?? 0) > 1) reason = "Código ambíguo na fonte: nenhuma aplicação";
    else if (!coords(r)) reason = "Coordenada inválida, placeholder ou fora do Brasil";
    if (reason)
      audit.push({
        code: r.code,
        kind,
        reason,
        source: r.source,
        precision: r.precision,
        url: r.url,
        notes: r.notes,
      });
    else additions.set(k, r);
  }
  const result = base.map((p) => {
    const r = additions.get(key(p.code, kind));
    if (!r) return { ...p };
    if (!absent(p.lat) && !absent(p.lng)) {
      audit.push({
        code: p.code,
        kind,
        reason: "Coordenadas presentes preservadas",
        source: r.source,
      });
      return { ...p };
    }
    // Never overwrite even one present component; validate the composed pair.
    const lat = absent(p.lat) ? r.lat : p.lat,
      lng = absent(p.lng) ? r.lng : p.lng;
    if (!coords({ lat, lng })) {
      audit.push({
        code: p.code,
        kind,
        reason: "Par composto inválido; fonte preservada",
        source: r.source,
      });
      return { ...p };
    }
    audit.push({
      code: p.code,
      kind,
      reason: "Suplemento aplicado apenas aos campos ausentes",
      source: r.source,
      precision: r.precision,
      url: r.url,
      notes: r.notes,
    });
    return {
      ...p,
      lat,
      lng,
      precision: r.precision || "Suplementar — precisão não informada",
      source: `${p.source}; suplemento ${r.source}`,
      url: r.url,
      notes: `${p.notes}; ${r.notes}`,
    };
  });
  return { points: result, audit };
}
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const v =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * EARTH_KM * Math.atan2(Math.sqrt(Math.min(1, v)), Math.sqrt(Math.max(0, 1 - v)));
}
export const band = (km: number) => (km <= 3 ? "0–3 km" : km <= 10 ? "3–10 km" : ">10 km");
export type Pair = { hotel: Point; office: Point; km: number; band: string };
export function calculate(hotels: Point[], offices: Point[], inputAudit: Audit[] = []) {
  const pairs: Pair[] = [];
  const officeSummary = offices.map((office) => ({ office, count: 0 }));
  const hotelSummary = hotels.map((hotel) => ({
    hotel,
    count: 0,
    nearest: null as Point | null,
    km: null as number | null,
  }));
  const locatedOffices = officeSummary.flatMap((o) => {
    const c = coords(o.office);
    return c ? [{ ...o, c, summary: o }] : [];
  });
  for (const h of hotelSummary) {
    const c = coords(h.hotel);
    if (!c) continue;
    for (const o of locatedOffices) {
      const km = haversine(c, o.c);
      if (h.km === null || km < h.km) {
        h.km = km;
        h.nearest = o.office;
      }
      if (km <= 10) {
        h.count++;
        o.summary.count++;
        pairs.push({ hotel: h.hotel, office: o.office, km, band: band(km) });
      }
    }
  }
  pairs.sort(
    (a, b) =>
      a.office.code.localeCompare(b.office.code) ||
      a.office.id.localeCompare(b.office.id) ||
      a.km - b.km ||
      a.hotel.id.localeCompare(b.hotel.id),
  );
  const audit = [
    ...inputAudit,
    ...[...hotels, ...offices].map((p) => ({
      code: p.code,
      kind: p.kind,
      reason: coords(p)
        ? "Incluída igualmente; distância indicativa, não viária"
        : "Sem coordenadas aptas (ausentes/inválidas/fora do Brasil)",
      source: p.source,
      precision: p.precision,
      url: p.url,
      notes: p.notes,
    })),
  ];
  return { pairs, officeSummary, hotelSummary, audit, hotels, offices };
}
export type Result = ReturnType<typeof calculate>;
