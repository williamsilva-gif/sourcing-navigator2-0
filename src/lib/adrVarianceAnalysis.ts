// Pure analysis: ADR realizado (bookings) vs ADR esperado (contracts.negotiated_adr)
// per hotel within a period window.
import type { Booking, Contract } from "./baselineSchemas";

export interface AdrVarianceRow {
  hotel: string;
  city: string;
  negotiatedAdr: number;
  realizedAdr: number;
  variancePct: number; // (realized - negotiated) / negotiated * 100
  leakage: number; // (realizedAdr - negotiatedAdr) * room_nights, only if positive
  roomNights: number;
  bookings: number;
  // Inferred severity:
  // high: variance >= 10%, medium: 5..10%, low: 2..5%, none: < 2%
  severity: "high" | "medium" | "low" | "ok";
  inferredCauses: string[];
}

export interface AdrVarianceSummary {
  hotelCount: number;
  rows: AdrVarianceRow[];
  weightedNegotiated: number;
  weightedRealized: number;
  variancePct: number;
  totalLeakage: number;
  flaggedCount: number; // rows with severity !== "ok"
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferCauses(variancePct: number): string[] {
  if (variancePct < 2) return [];
  const causes: string[] = [];
  if (variancePct >= 10) {
    causes.push("Tarifa negociada não carregada no GDS/canal");
    causes.push("Bloqueio de disponibilidade (blackout) em datas-chave");
  } else if (variancePct >= 5) {
    causes.push("LRA não respeitada em parte das estadias");
    causes.push("Baixa disponibilidade na tarifa contratada");
  } else {
    causes.push("Drift pontual de tarifa em datas específicas");
  }
  return causes;
}

function severityFor(variancePct: number): AdrVarianceRow["severity"] {
  if (variancePct >= 10) return "high";
  if (variancePct >= 5) return "medium";
  if (variancePct >= 2) return "low";
  return "ok";
}

export function computeAdrVariance(
  bookings: Booking[],
  contracts: Contract[],
): AdrVarianceSummary {
  // Index contracts by hotel (case-insensitive, last wins — most-recent upload)
  const contractByHotel = new Map<string, Contract>();
  for (const c of contracts) {
    contractByHotel.set(c.hotel.trim().toLowerCase(), c);
  }

  // Aggregate bookings by hotel
  type Agg = { hotel: string; city: string; spend: number; rn: number; count: number };
  const byHotel = new Map<string, Agg>();
  for (const b of bookings) {
    const key = b.hotel.trim().toLowerCase();
    const cur = byHotel.get(key) ?? { hotel: b.hotel, city: b.city, spend: 0, rn: 0, count: 0 };
    cur.spend += b.room_nights * b.adr;
    cur.rn += b.room_nights;
    cur.count += 1;
    byHotel.set(key, cur);
  }

  const rows: AdrVarianceRow[] = [];
  let totalNegotiatedSpend = 0;
  let totalRealizedSpend = 0;
  let totalRn = 0;
  let totalLeakage = 0;

  for (const [key, agg] of byHotel) {
    const contract = contractByHotel.get(key);
    if (!contract || contract.negotiated_adr <= 0) continue;
    if (agg.rn <= 0) continue;
    const realized = agg.spend / agg.rn;
    const negotiated = contract.negotiated_adr;
    const variancePct = ((realized - negotiated) / negotiated) * 100;
    const leakage = realized > negotiated ? (realized - negotiated) * agg.rn : 0;
    const severity = severityFor(variancePct);
    rows.push({
      hotel: agg.hotel,
      city: agg.city,
      negotiatedAdr: negotiated,
      realizedAdr: realized,
      variancePct,
      leakage,
      roomNights: agg.rn,
      bookings: agg.count,
      severity,
      inferredCauses: inferCauses(variancePct),
    });
    totalNegotiatedSpend += negotiated * agg.rn;
    totalRealizedSpend += agg.spend;
    totalRn += agg.rn;
    totalLeakage += leakage;
  }

  // Sort: highest variance first
  rows.sort((a, b) => b.variancePct - a.variancePct);

  const weightedNegotiated = totalRn > 0 ? totalNegotiatedSpend / totalRn : 0;
  const weightedRealized = totalRn > 0 ? totalRealizedSpend / totalRn : 0;
  const variancePct =
    weightedNegotiated > 0
      ? ((weightedRealized - weightedNegotiated) / weightedNegotiated) * 100
      : 0;

  return {
    hotelCount: rows.length,
    rows,
    weightedNegotiated,
    weightedRealized,
    variancePct,
    totalLeakage,
    flaggedCount: rows.filter((r) => r.severity !== "ok").length,
  };
}

export function adrVarianceSignature(periodLabel: string, row: AdrVarianceRow): string {
  return `adrvar:${slug(periodLabel)}:${slug(row.hotel)}`;
}
