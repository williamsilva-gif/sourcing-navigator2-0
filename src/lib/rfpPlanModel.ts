// Pure model for the "Plano para a RFP 2026" decision engine.
// Separates ADR real (paid) from CAP negociado (contracts) and CAP sugerido
// (recommendation), and derives status, priority and reasons per city.

import type { Booking, Contract } from "./baselineSchemas";
import { capForBooking } from "./baselineStore";
import { filterByWindow, windowFor } from "./periodFilter";

export type CityStatus =
  | "sem_cobertura"
  | "leakage_critico"
  | "alta_concentracao"
  | "acima_cap"
  | "dentro_cap";

export type CityPriority = "Alta" | "Média" | "Baixa";

export interface CityRecommendation {
  city: string;
  bookings: number;
  spend: number;
  adr: number;
  currentCap: number | null;
  suggestedCap2026: number;
  gapPct: number;
  overCapPct: number;
  leakageSpend: number;
  estimatedSavings: number;
  hotelsInvolved: number;
  hotelsOverCap: number;
  top2Share: number;
  status: CityStatus;
  priority: CityPriority;
  reasons: string[];
  hotelsToRenegotiate: string[];
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

function deriveStatus(args: {
  hasContracts: boolean;
  overCapPct: number;
  top2Share: number;
  hotelsInvolved: number;
  gapPct: number;
}): CityStatus {
  if (!args.hasContracts) return "sem_cobertura";
  if (args.overCapPct >= 25) return "leakage_critico";
  if (args.top2Share >= 60 && args.hotelsInvolved >= 2) return "alta_concentracao";
  if (args.gapPct >= 8) return "acima_cap";
  return "dentro_cap";
}

function deriveReasons(r: {
  gapPct: number;
  overCapPct: number;
  top2Share: number;
  hasContracts: boolean;
}): string[] {
  const out: string[] = [];
  if (!r.hasContracts) out.push("Sem contratos vigentes para 2025");
  if (r.gapPct >= 8) out.push(`ADR ${r.gapPct.toFixed(1)}% acima do cap negociado`);
  if (r.overCapPct >= 15) out.push(`${r.overCapPct.toFixed(0)}% das reservas acima do cap`);
  if (r.top2Share >= 60) out.push(`${r.top2Share.toFixed(0)}% concentrado em 2 hotéis`);
  return out.slice(0, 2);
}

export function buildCityRecommendations(
  allBookings: Booking[],
  contracts: Contract[],
  year: string = "2025",
): CityRecommendation[] {
  const w = windowFor("year", year);
  if (!w) return [];
  const bookings = filterByWindow(allBookings, w);
  if (bookings.length === 0) return [];

  const byCity = new Map<string, Booking[]>();
  bookings.forEach((b) => {
    const arr = byCity.get(b.city) ?? [];
    arr.push(b);
    byCity.set(b.city, arr);
  });

  const out: CityRecommendation[] = [];
  byCity.forEach((bs, city) => {
    const rn = bs.reduce((s, b) => s + b.room_nights, 0);
    const spend = bs.reduce((s, b) => s + b.room_nights * b.adr, 0);
    const adr = rn > 0 ? spend / rn : 0;

    const cityContractCaps = contracts
      .filter((c) => bs.some((b) => b.hotel === c.hotel) && c.valid_until?.startsWith(year))
      .map((c) => c.cap);
    const hasContracts = cityContractCaps.length > 0;
    const currentCap = hasContracts
      ? Math.round(cityContractCaps.reduce((s, v) => s + v, 0) / cityContractCaps.length)
      : null;

    // Per-booking leakage (uses contract cap when present)
    const overCap = bs.filter((b) => b.adr > capForBooking(b, contracts));
    const overCapRn = overCap.reduce((s, b) => s + b.room_nights, 0);
    const overCapPct = rn > 0 ? (overCapRn / rn) * 100 : 0;
    const leakageSpend = overCap.reduce((s, b) => s + b.room_nights * b.adr, 0);

    // Concentration
    const byHotel = new Map<string, number>();
    bs.forEach((b) => byHotel.set(b.hotel, (byHotel.get(b.hotel) ?? 0) + b.room_nights));
    const sorted = Array.from(byHotel.values()).sort((a, b) => b - a);
    const top2Share = rn > 0 ? (((sorted[0] ?? 0) + (sorted[1] ?? 0)) / rn) * 100 : 0;
    const hotelsInvolved = byHotel.size;
    const hotelsOverCap = new Set(overCap.map((b) => b.hotel)).size;

    // Suggested cap: 95% of ADR but never above currentCap * 1.02 if it exists.
    const target = adr * 0.95;
    const ceiling = currentCap != null ? currentCap * 1.02 : Infinity;
    const suggestedCap2026 = round5(Math.min(target, ceiling));

    const gapPct = currentCap && currentCap > 0 ? ((adr - currentCap) / currentCap) * 100 : 0;
    const status = deriveStatus({
      hasContracts,
      overCapPct,
      top2Share,
      hotelsInvolved,
      gapPct,
    });

    const reasons = deriveReasons({ gapPct, overCapPct, top2Share, hasContracts });
    const estimatedSavings = Math.round(leakageSpend * 0.35);
    const hotelsToRenegotiate = Array.from(new Set(overCap.map((b) => b.hotel))).slice(0, 6);

    out.push({
      city,
      bookings: bs.length,
      spend,
      adr,
      currentCap,
      suggestedCap2026,
      gapPct,
      overCapPct,
      leakageSpend,
      estimatedSavings,
      hotelsInvolved,
      hotelsOverCap,
      top2Share,
      status,
      priority: "Baixa",
      reasons,
      hotelsToRenegotiate,
    });
  });

  // Priority depends on totals across the set.
  const totalSavings = out.reduce((s, r) => s + r.estimatedSavings, 0);
  out.forEach((r) => {
    if (r.status === "leakage_critico") r.priority = "Alta";
    else if (totalSavings > 0 && r.estimatedSavings / totalSavings >= 0.3) r.priority = "Alta";
    else if (r.status === "acima_cap" || r.status === "alta_concentracao") r.priority = "Média";
    else r.priority = "Baixa";
  });

  const prioOrder: Record<CityPriority, number> = { Alta: 0, "Média": 1, Baixa: 2 };
  return out.sort((a, b) => {
    const dp = prioOrder[a.priority] - prioOrder[b.priority];
    if (dp !== 0) return dp;
    return b.estimatedSavings - a.estimatedSavings;
  });
}

export const STATUS_META: Record<
  CityStatus,
  { label: string; tone: "destructive" | "warning" | "success" | "muted" }
> = {
  leakage_critico: { label: "Leakage crítico", tone: "destructive" },
  acima_cap: { label: "Acima do cap", tone: "warning" },
  alta_concentracao: { label: "Alta concentração", tone: "warning" },
  sem_cobertura: { label: "Sem cobertura", tone: "muted" },
  dentro_cap: { label: "Dentro do cap", tone: "success" },
};
