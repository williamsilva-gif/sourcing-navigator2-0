// Rule-based recommendation engine.
// Pure functions: consume baseline data + capOverrides, return derived
// CriticalAlerts and Opportunities. Falls back to mocks when no baseline.

import type { Booking } from "./baselineSchemas";
import type { CriticalAlert, Opportunity, RecommendedAction } from "@/components/dashboard/decisionData";

const BASE_CAP = 280;

function effectiveCapFor(city: string, capOverrides: Record<string, number>): number {
  return capOverrides[city] ?? BASE_CAP;
}

interface CityStats {
  city: string;
  bookings: Booking[];
  roomNights: number;
  spend: number;
  adr: number;
  cap: number;
  overCapSpend: number;
  overCapPct: number; // % of spend above cap
  compliancePct: number; // % of room nights at or below cap
  hotelTop2Share: number; // % of room nights from top 2 hotels
  hotelCount: number;
}

function computeCityStats(bookings: Booking[], capOverrides: Record<string, number>): CityStats[] {
  const byCity = new Map<string, Booking[]>();
  bookings.forEach((b) => {
    const arr = byCity.get(b.city) ?? [];
    arr.push(b);
    byCity.set(b.city, arr);
  });

  const stats: CityStats[] = [];
  byCity.forEach((bs, city) => {
    const cap = effectiveCapFor(city, capOverrides);
    const roomNights = bs.reduce((s, b) => s + b.room_nights, 0);
    const spend = bs.reduce((s, b) => s + b.room_nights * b.adr, 0);
    const adr = roomNights > 0 ? spend / roomNights : 0;
    const overCap = bs.filter((b) => b.adr > cap);
    const overCapSpend = overCap.reduce((s, b) => s + b.room_nights * b.adr, 0);
    const overCapPct = spend > 0 ? (overCapSpend / spend) * 100 : 0;
    const inCapRn = bs.filter((b) => b.adr <= cap).reduce((s, b) => s + b.room_nights, 0);
    const compliancePct = roomNights > 0 ? (inCapRn / roomNights) * 100 : 0;

    // Hotel concentration
    const byHotel = new Map<string, number>();
    bs.forEach((b) => byHotel.set(b.hotel, (byHotel.get(b.hotel) ?? 0) + b.room_nights));
    const sortedHotels = Array.from(byHotel.values()).sort((a, b) => b - a);
    const top2 = (sortedHotels[0] ?? 0) + (sortedHotels[1] ?? 0);
    const hotelTop2Share = roomNights > 0 ? (top2 / roomNights) * 100 : 0;

    stats.push({
      city,
      bookings: bs,
      roomNights,
      spend,
      adr,
      cap,
      overCapSpend,
      overCapPct,
      compliancePct,
      hotelTop2Share,
      hotelCount: byHotel.size,
    });
  });
  return stats.sort((a, b) => b.spend - a.spend);
}

function severityFromGap(gapPct: number, mediumThreshold: number, highThreshold: number): CriticalAlert["severity"] {
  if (gapPct >= highThreshold) return "high";
  if (gapPct >= mediumThreshold) return "medium";
  return "low";
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function fmtUsdShort(n: number): string {
  if (n >= 1_000_000) return `US$ ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `US$ ${Math.round(n / 1000)}k`;
  return `US$ ${Math.round(n)}`;
}

interface EngineOutput {
  alerts: CriticalAlert[];
  opportunities: Opportunity[];
}

export function evaluateRules(
  bookings: Booking[],
  capOverrides: Record<string, number>,
): EngineOutput {
  if (!bookings || bookings.length === 0) {
    return { alerts: [], opportunities: [] };
  }

  const stats = computeCityStats(bookings, capOverrides);
  const alerts: CriticalAlert[] = [];
  const opportunities: Opportunity[] = [];

  // Global leakage
  const totalSpend = stats.reduce((s, c) => s + c.spend, 0);
  const totalOverCap = stats.reduce((s, c) => s + c.overCapSpend, 0);
  const globalLeakagePct = totalSpend > 0 ? (totalOverCap / totalSpend) * 100 : 0;

  if (globalLeakagePct > 15) {
    const oppId = `opp-leak-global`;
    alerts.push({
      id: `alert-leak-global`,
      title: `Leakage global em ${fmtPct(globalLeakagePct)}`,
      description: `Reservas acima do cap representam ${fmtUsdShort(totalOverCap)} do spend total.`,
      severity: severityFromGap(globalLeakagePct, 15, 25),
      metric: `${fmtPct(globalLeakagePct)} do spend`,
      opportunityId: oppId,
    });
  }

  // Per-city rules
  stats.forEach((c) => {
    const cityActions: RecommendedAction[] = [];
    const reasons: string[] = [];
    let oppSavings = 0;
    let oppPriority = "low" as Opportunity["priority"];

    // Rule 1: ADR > Cap by 8%+
    const adrGapPct = c.cap > 0 ? ((c.adr - c.cap) / c.cap) * 100 : 0;
    if (adrGapPct >= 8) {
      const sev = severityFromGap(adrGapPct, 8, 15);
      const oppId = `opp-${c.city}-adr`;
      alerts.push({
        id: `alert-${c.city}-adr`,
        title: `ADR de ${c.city} ${fmtPct(adrGapPct)} acima do cap`,
        description: `Cap efetivo: US$ ${c.cap}. ADR efetivo: US$ ${Math.round(c.adr)}.`,
        severity: sev,
        metric: `+US$ ${Math.round(c.adr - c.cap)} / room night`,
        opportunityId: oppId,
      });

      const targetReduction = Math.min(15, Math.round(adrGapPct));
      const renegSavings = Math.round(c.overCapSpend * 0.45);
      const capSavings = Math.round(c.overCapSpend * 0.3);
      cityActions.push({
        id: `act-${c.city}-reneg`,
        label: `Lançar renegociação para reduzir ADR em ${targetReduction}%`,
        impact: renegSavings,
        effort: "medium",
        payload: {
          kind: "renegotiation",
          data: { city: c.city, hotels: Math.min(5, c.hotelCount), targetAdrReduction: targetReduction },
        },
      });
      const newCap = Math.round(c.adr * 0.95);
      cityActions.push({
        id: `act-${c.city}-cap`,
        label: `Reduzir city cap de US$ ${c.cap} para US$ ${newCap}`,
        impact: capSavings,
        effort: "low",
        payload: { kind: "cap_adjustment", data: { city: c.city, fromCap: c.cap, toCap: newCap } },
      });
      reasons.push(`ADR ${fmtPct(adrGapPct)} acima do cap`);
      oppSavings += renegSavings + capSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    // Rule 2: Compliance < 75%
    if (c.compliancePct < 75 && c.roomNights > 0) {
      const gap = 75 - c.compliancePct;
      const sev = severityFromGap(gap, 5, 15);
      const oppId = `opp-${c.city}-comp`;
      alerts.push({
        id: `alert-${c.city}-comp`,
        title: `Compliance de ${c.city} em ${fmtPct(c.compliancePct)}`,
        description: `Abaixo do threshold de 75%. Risco de leakage e perda de poder de negociação.`,
        severity: sev,
        metric: `${fmtPct(c.compliancePct)} (meta 75%)`,
        opportunityId: oppId,
      });
      const portfolioSavings = Math.round(c.spend * 0.04);
      cityActions.push({
        id: `act-${c.city}-portfolio`,
        label: `Revisar portfólio e remover hotéis fora do programa`,
        impact: portfolioSavings,
        effort: "high",
        payload: {
          kind: "cluster_change",
          data: { city: c.city, hotelsToAdd: 2, toCluster: "Drop" },
        },
      });
      cityActions.push({
        id: `act-${c.city}-comm`,
        label: `Comunicação dirigida + lembrete no booking tool`,
        impact: Math.round(portfolioSavings * 0.4),
        effort: "low",
        payload: { kind: "communication", data: { city: c.city, channel: "Email + booking tool" } },
      });
      reasons.push(`compliance em ${fmtPct(c.compliancePct)}`);
      oppSavings += portfolioSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    // Rule 3: City-level leakage > 15%
    if (c.overCapPct > 15) {
      const oppId = `opp-${c.city}-leak`;
      const sev = severityFromGap(c.overCapPct, 15, 25);
      alerts.push({
        id: `alert-${c.city}-leak`,
        title: `Leakage em ${c.city}: ${fmtPct(c.overCapPct)}`,
        description: `${fmtUsdShort(c.overCapSpend)} acima do cap. Expandir preferred reduz dependência.`,
        severity: sev,
        metric: `${fmtPct(c.overCapPct)} do spend`,
        opportunityId: oppId,
      });
      const expandSavings = Math.round(c.overCapSpend * 0.25);
      cityActions.push({
        id: `act-${c.city}-expand`,
        label: `Adicionar 3 hotéis ao cluster Preferred`,
        impact: expandSavings,
        effort: "medium",
        payload: {
          kind: "cluster_change",
          data: { city: c.city, hotelsToAdd: 3, toCluster: "Preferred" },
        },
      });
      reasons.push(`leakage de ${fmtPct(c.overCapPct)}`);
      oppSavings += expandSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    // Rule 4: Top 2 hotels > 50% volume
    if (c.hotelTop2Share > 50 && c.hotelCount >= 2) {
      const oppId = `opp-${c.city}-conc`;
      alerts.push({
        id: `alert-${c.city}-conc`,
        title: `Concentração em ${c.city}: ${fmtPct(c.hotelTop2Share)} em 2 hotéis`,
        description: `Falta competição. Mini-RFP com novos fornecedores reduz dependência.`,
        severity: c.hotelTop2Share > 70 ? "high" : "medium",
        metric: `${fmtPct(c.hotelTop2Share)} em top 2`,
        opportunityId: oppId,
      });
      const rfpSavings = Math.round(c.spend * 0.06);
      cityActions.push({
        id: `act-${c.city}-rfp`,
        label: `Mini-RFP com 4 hotéis adicionais para aumentar competição`,
        impact: rfpSavings,
        effort: "high",
        payload: { kind: "mini_rfp", data: { city: c.city, hotels: 4 } },
      });
      reasons.push(`${fmtPct(c.hotelTop2Share)} concentrado em 2 hotéis`);
      oppSavings += rfpSavings;
      if (oppPriority !== "high") oppPriority = c.hotelTop2Share > 70 ? "high" : "medium";
    }

    if (cityActions.length > 0 && oppSavings > 0) {
      // Use the first matching alert's opportunityId so alerts can link to opp
      const linkedAlert = alerts.find((a) => a.opportunityId?.startsWith(`opp-${c.city}-`));
      const oppId = linkedAlert?.opportunityId ?? `opp-${c.city}`;
      // Re-point all matching alerts to the consolidated opportunity id
      alerts.forEach((a) => {
        if (a.opportunityId?.startsWith(`opp-${c.city}-`)) a.opportunityId = oppId;
      });

      opportunities.push({
        id: oppId,
        scope: c.city,
        region: "LATAM",
        savings: oppSavings,
        reason: reasons.join(" · "),
        priority: oppPriority,
        adrBefore: Math.round(c.adr),
        complianceBefore: Math.round(c.compliancePct),
        actions: cityActions.slice(0, 3),
      });
    }
  });

  // Sort: alerts by severity, opportunities by savings desc
  const sevOrder = { high: 0, medium: 1, low: 2 } as const;
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  opportunities.sort((a, b) => b.savings - a.savings);

  return { alerts: alerts.slice(0, 6), opportunities: opportunities.slice(0, 6) };
}
