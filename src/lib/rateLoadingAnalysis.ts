// Rate Loading Failure Detection
// Detects bookings where realized ADR exceeds negotiated ADR significantly,
// suggesting tariff was not loaded, blackout in place, LRA violated, or availability issue.
import type { Booking, Contract } from "./baselineSchemas";

export type RateLoadingCause =
  | "loading_issue"
  | "blackout"
  | "lra_conflict"
  | "availability";

export interface RateLoadingRow {
  hotel: string;
  city: string;
  negotiatedAdr: number;
  realizedAdr: number;
  variancePct: number;
  affectedBookings: number;
  totalBookings: number;
  affectedRn: number;
  estimatedLoss: number;
  severity: "high" | "medium" | "low";
  suspectedCause: RateLoadingCause;
  causeLabel: string;
}

export interface RateLoadingSummary {
  rows: RateLoadingRow[];
  totalLoss: number;
  flaggedHotels: number;
  affectedBookings: number;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferCause(
  variancePct: number,
  affectedShare: number,
  contract: Contract,
): { cause: RateLoadingCause; label: string } {
  // Heuristics based on signal strength
  const raw = ((contract as unknown as { raw?: Record<string, unknown> }).raw ?? {}) as Record<
    string,
    unknown
  >;
  const hasBlackoutMeta =
    Array.isArray(raw.blackouts) && (raw.blackouts as unknown[]).length > 0;
  const hasLraMeta = raw.lra !== undefined || raw.last_room_availability !== undefined;

  if (hasBlackoutMeta && variancePct >= 8) {
    return { cause: "blackout", label: "Período de blackout ativo no contrato" };
  }
  if (hasLraMeta && variancePct >= 5 && variancePct < 12) {
    return { cause: "lra_conflict", label: "LRA (Last Room Availability) não respeitada" };
  }
  if (affectedShare >= 0.6 && variancePct >= 8) {
    return {
      cause: "loading_issue",
      label: "Tarifa contratada não carregada no GDS/canal",
    };
  }
  if (variancePct >= 12) {
    return {
      cause: "loading_issue",
      label: "Tarifa contratada não carregada no GDS/canal",
    };
  }
  return {
    cause: "availability",
    label: "Baixa disponibilidade da tarifa contratada nas datas reservadas",
  };
}

function severityFor(variancePct: number, affectedShare: number): RateLoadingRow["severity"] {
  if (variancePct >= 12 || (variancePct >= 8 && affectedShare >= 0.5)) return "high";
  if (variancePct >= 6) return "medium";
  return "low";
}

// Threshold: realized ADR must exceed negotiated by at least this %
// for an individual booking to count as "affected".
const PER_BOOKING_THRESHOLD_PCT = 3;

export function computeRateLoading(
  bookings: Booking[],
  contracts: Contract[],
): RateLoadingSummary {
  const contractByHotel = new Map<string, Contract>();
  for (const c of contracts) contractByHotel.set(c.hotel.trim().toLowerCase(), c);

  type Agg = {
    hotel: string;
    city: string;
    contract: Contract;
    totalBookings: number;
    affectedBookings: number;
    affectedRn: number;
    affectedSpend: number;
    realizedSpend: number;
    realizedRn: number;
  };
  const byHotel = new Map<string, Agg>();

  for (const b of bookings) {
    const key = b.hotel.trim().toLowerCase();
    const contract = contractByHotel.get(key);
    if (!contract || contract.negotiated_adr <= 0) continue;
    const agg = byHotel.get(key) ?? {
      hotel: b.hotel,
      city: b.city,
      contract,
      totalBookings: 0,
      affectedBookings: 0,
      affectedRn: 0,
      affectedSpend: 0,
      realizedSpend: 0,
      realizedRn: 0,
    };
    agg.totalBookings += 1;
    agg.realizedSpend += b.adr * b.room_nights;
    agg.realizedRn += b.room_nights;
    const overPct = ((b.adr - contract.negotiated_adr) / contract.negotiated_adr) * 100;
    if (overPct >= PER_BOOKING_THRESHOLD_PCT) {
      agg.affectedBookings += 1;
      agg.affectedRn += b.room_nights;
      agg.affectedSpend += b.adr * b.room_nights;
    }
    byHotel.set(key, agg);
  }

  const rows: RateLoadingRow[] = [];
  let totalLoss = 0;
  let affectedBookings = 0;

  for (const agg of byHotel.values()) {
    if (agg.affectedBookings === 0 || agg.affectedRn === 0) continue;
    const realizedAdr = agg.affectedSpend / agg.affectedRn;
    const negotiatedAdr = agg.contract.negotiated_adr;
    const variancePct = ((realizedAdr - negotiatedAdr) / negotiatedAdr) * 100;
    if (variancePct < 3) continue;
    const estimatedLoss = (realizedAdr - negotiatedAdr) * agg.affectedRn;
    const affectedShare = agg.affectedBookings / agg.totalBookings;
    const { cause, label } = inferCause(variancePct, affectedShare, agg.contract);
    rows.push({
      hotel: agg.hotel,
      city: agg.city,
      negotiatedAdr,
      realizedAdr,
      variancePct,
      affectedBookings: agg.affectedBookings,
      totalBookings: agg.totalBookings,
      affectedRn: agg.affectedRn,
      estimatedLoss,
      severity: severityFor(variancePct, affectedShare),
      suspectedCause: cause,
      causeLabel: label,
    });
    totalLoss += estimatedLoss;
    affectedBookings += agg.affectedBookings;
  }

  rows.sort((a, b) => b.estimatedLoss - a.estimatedLoss);

  return {
    rows,
    totalLoss,
    flaggedHotels: rows.length,
    affectedBookings,
  };
}

export function rateLoadingSignature(periodLabel: string, row: RateLoadingRow): string {
  return `rateload:${slug(periodLabel)}:${slug(row.hotel)}`;
}
