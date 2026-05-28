// Hotel Underperformance Detection
// Detects contracted hotels that received much less volume than expected.
// Expected volume = contract.cap (room nights) OR a baseline share among peers in the same city.
import type { Booking, Contract } from "./baselineSchemas";

export type UnderperformanceCause =
  | "location"
  | "availability"
  | "traveler_preference"
  | "service";

export interface UnderperformanceRow {
  hotel: string;
  city: string;
  expectedRn: number;
  actualRn: number;
  gapRn: number;
  utilizationPct: number; // actual / expected * 100
  bookings: number;
  negotiatedAdr: number;
  estimatedMissedSpend: number; // gapRn * negotiatedAdr
  severity: "high" | "medium" | "low";
  suspectedCauses: { cause: UnderperformanceCause; label: string }[];
  expectedSource: "cap" | "peer_average";
}

export interface UnderperformanceSummary {
  rows: UnderperformanceRow[];
  totalGapRn: number;
  totalMissedSpend: number;
  flaggedHotels: number;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function severityFor(utilPct: number): UnderperformanceRow["severity"] {
  if (utilPct < 25) return "high";
  if (utilPct < 50) return "medium";
  return "low";
}

function inferCauses(
  utilPct: number,
  hasCompetitorVolume: boolean,
): { cause: UnderperformanceCause; label: string }[] {
  const causes: { cause: UnderperformanceCause; label: string }[] = [];
  if (hasCompetitorVolume) {
    causes.push({
      cause: "traveler_preference",
      label: "Viajantes preferindo outros hotéis na mesma cidade",
    });
  }
  if (utilPct < 25) {
    causes.push({
      cause: "location",
      label: "Localização distante dos principais POIs / escritórios",
    });
    causes.push({
      cause: "availability",
      label: "Disponibilidade limitada na tarifa negociada",
    });
  } else {
    causes.push({
      cause: "availability",
      label: "Disponibilidade intermitente da tarifa negociada",
    });
  }
  if (utilPct < 15) {
    causes.push({
      cause: "service",
      label: "Possível issue de serviço/qualidade (revisar NPS interno)",
    });
  }
  return causes;
}

export function computeHotelUnderperformance(
  bookings: Booking[],
  contracts: Contract[],
): UnderperformanceSummary {
  // Index contracted hotels (lowercased name)
  const contractByHotel = new Map<string, Contract>();
  for (const c of contracts) contractByHotel.set(c.hotel.trim().toLowerCase(), c);

  // Aggregate actual booking volume per contracted hotel + per city totals (for peer share)
  type Agg = { hotel: string; city: string; rn: number; count: number };
  const byHotel = new Map<string, Agg>();
  const cityRnTotal = new Map<string, number>();
  const cityHotelsContracted = new Map<string, Set<string>>();

  for (const c of contracts) {
    const cityKey = (c.hotel ? c.hotel : "").toLowerCase();
    void cityKey;
  }

  for (const b of bookings) {
    const key = b.hotel.trim().toLowerCase();
    const ck = b.city.trim().toLowerCase();
    cityRnTotal.set(ck, (cityRnTotal.get(ck) ?? 0) + b.room_nights);
    if (!contractByHotel.has(key)) continue;
    const cur = byHotel.get(key) ?? { hotel: b.hotel, city: b.city, rn: 0, count: 0 };
    cur.rn += b.room_nights;
    cur.count += 1;
    byHotel.set(key, cur);
  }

  // Discover city → contracted hotel set
  for (const c of contracts) {
    // Find any booking with this hotel to know its city; fallback skip
    const sample = bookings.find((b) => b.hotel.trim().toLowerCase() === c.hotel.trim().toLowerCase());
    const ck = (sample?.city ?? "").trim().toLowerCase();
    if (!ck) continue;
    const set = cityHotelsContracted.get(ck) ?? new Set<string>();
    set.add(c.hotel.trim().toLowerCase());
    cityHotelsContracted.set(ck, set);
  }

  const rows: UnderperformanceRow[] = [];

  for (const c of contracts) {
    const key = c.hotel.trim().toLowerCase();
    const agg = byHotel.get(key);
    const actualRn = agg?.rn ?? 0;
    const bookingsCount = agg?.count ?? 0;
    const city = agg?.city ?? "";
    const cityKey = city.toLowerCase();

    // Expected volume:
    // 1) Prefer contract cap when > 0
    // 2) Otherwise peer-average: city total RN / number of contracted hotels in city
    let expectedRn = 0;
    let expectedSource: "cap" | "peer_average" = "cap";
    if (c.cap > 0) {
      expectedRn = c.cap;
      expectedSource = "cap";
    } else {
      const cityTotal = cityRnTotal.get(cityKey) ?? 0;
      const peers = cityHotelsContracted.get(cityKey)?.size ?? 1;
      expectedRn = peers > 0 ? cityTotal / peers : 0;
      expectedSource = "peer_average";
    }
    if (expectedRn <= 0) continue;
    if (actualRn >= expectedRn) continue;

    const utilizationPct = (actualRn / expectedRn) * 100;
    if (utilizationPct >= 70) continue; // not underperforming

    const cityTotal = cityRnTotal.get(cityKey) ?? 0;
    const hasCompetitorVolume = cityTotal > actualRn * 2;
    const gapRn = expectedRn - actualRn;
    const estimatedMissedSpend = gapRn * c.negotiated_adr;

    rows.push({
      hotel: c.hotel,
      city: city || "—",
      expectedRn,
      actualRn,
      gapRn,
      utilizationPct,
      bookings: bookingsCount,
      negotiatedAdr: c.negotiated_adr,
      estimatedMissedSpend,
      severity: severityFor(utilizationPct),
      suspectedCauses: inferCauses(utilizationPct, hasCompetitorVolume),
      expectedSource,
    });
  }

  rows.sort((a, b) => b.estimatedMissedSpend - a.estimatedMissedSpend);

  return {
    rows,
    totalGapRn: rows.reduce((s, r) => s + r.gapRn, 0),
    totalMissedSpend: rows.reduce((s, r) => s + r.estimatedMissedSpend, 0),
    flaggedHotels: rows.length,
  };
}

export function underperformanceSignature(periodLabel: string, row: UnderperformanceRow): string {
  return `underperf:${slug(periodLabel)}:${slug(row.hotel)}`;
}
