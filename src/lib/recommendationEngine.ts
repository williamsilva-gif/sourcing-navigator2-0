// Rule-based recommendation engine.
// Pure functions: consume baseline data + overrides, return derived
// CriticalAlerts and Opportunities.

import type { Booking } from "./baselineSchemas";
import type { CriticalAlert, Opportunity, RecommendedAction } from "@/components/dashboard/decisionData";
import type { PortfolioOverride } from "./actionStore";
import type { Thresholds } from "./appConfigStore";

export interface EngineOverrides {
  capOverrides: Record<string, number>;
  adrAdjustments?: Record<string, number>; // city -> % (negative = reduction)
  portfolioOverrides?: Record<string, PortfolioOverride>;
  marketExpansion?: Record<string, boolean>;
  executedOpportunityIds?: string[];
  defaultCap?: number;
  thresholds?: Thresholds;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  adrGapPct: 8,
  compliancePct: 75,
  leakagePct: 15,
  concentrationPct: 50,
};

const DEFAULT_CAP = 280;

interface CityStats {
  city: string;
  bookings: Booking[];
  roomNights: number;
  spend: number;
  adr: number; // effective ADR (after adrAdjustments)
  rawAdr: number;
  cap: number;
  overCapSpend: number;
  overCapPct: number;
  compliancePct: number;
  hotelTop2Share: number; // adjusted by marketExpansion
  hotelCount: number;
}

function computeCityStats(bookings: Booking[], overrides: EngineOverrides): CityStats[] {
  const baseCap = overrides.defaultCap ?? DEFAULT_CAP;
  const byCity = new Map<string, Booking[]>();
  bookings.forEach((b) => {
    const arr = byCity.get(b.city) ?? [];
    arr.push(b);
    byCity.set(b.city, arr);
  });

  const stats: CityStats[] = [];
  byCity.forEach((bs, city) => {
    const cap = overrides.capOverrides[city] ?? baseCap;
    const adrAdj = overrides.adrAdjustments?.[city] ?? 0; // negative %
    const adrFactor = 1 + adrAdj / 100;

    const roomNights = bs.reduce((s, b) => s + b.room_nights, 0);
    const rawSpend = bs.reduce((s, b) => s + b.room_nights * b.adr, 0);
    const spend = rawSpend * adrFactor;
    const rawAdr = roomNights > 0 ? rawSpend / roomNights : 0;
    const adr = rawAdr * adrFactor;

    const overCap = bs.filter((b) => b.adr * adrFactor > cap);
    const overCapSpend = overCap.reduce((s, b) => s + b.room_nights * b.adr * adrFactor, 0);
    const overCapPct = spend > 0 ? (overCapSpend / spend) * 100 : 0;
    const inCapRn = bs.filter((b) => b.adr * adrFactor <= cap).reduce((s, b) => s + b.room_nights, 0);
    const compliancePct = roomNights > 0 ? (inCapRn / roomNights) * 100 : 0;

    const byHotel = new Map<string, number>();
    bs.forEach((b) => byHotel.set(b.hotel, (byHotel.get(b.hotel) ?? 0) + b.room_nights));
    const sortedHotels = Array.from(byHotel.values()).sort((a, b) => b - a);
    const top2 = (sortedHotels[0] ?? 0) + (sortedHotels[1] ?? 0);
    let hotelTop2Share = roomNights > 0 ? (top2 / roomNights) * 100 : 0;

    // Adjustments: marketExpansion reduces concentration by ~15pp; portfolioOverrides reduces by 5pp per added hotel
    if (overrides.marketExpansion?.[city]) hotelTop2Share = Math.max(0, hotelTop2Share - 15);
    const portfolio = overrides.portfolioOverrides?.[city];
    if (portfolio) hotelTop2Share = Math.max(0, hotelTop2Share - portfolio.addedHotels * 5);

    stats.push({
      city,
      bookings: bs,
      roomNights,
      spend,
      adr,
      rawAdr,
      cap,
      overCapSpend,
      overCapPct,
      compliancePct,
      hotelTop2Share,
      hotelCount: byHotel.size + (portfolio?.addedHotels ?? 0),
    });
  });
  return stats.sort((a, b) => b.spend - a.spend);
}

function severityFromGap(gapPct: number, mediumThreshold: number, highThreshold: number): CriticalAlert["severity"] {
  if (gapPct >= highThreshold) return "high";
  if (gapPct >= mediumThreshold) return "medium";
  return "low";
}

function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
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
  overridesOrCapOverrides: EngineOverrides | Record<string, number>,
): EngineOutput {
  if (!bookings || bookings.length === 0) {
    return { alerts: [], opportunities: [] };
  }

  // Back-compat: accept either an EngineOverrides object or a plain capOverrides map
  const overrides: EngineOverrides =
    overridesOrCapOverrides && typeof overridesOrCapOverrides === "object" && "capOverrides" in overridesOrCapOverrides
      ? (overridesOrCapOverrides as EngineOverrides)
      : { capOverrides: (overridesOrCapOverrides as Record<string, number>) ?? {} };

  const th = overrides.thresholds ?? DEFAULT_THRESHOLDS;
  const executedSet = new Set(overrides.executedOpportunityIds ?? []);

  const stats = computeCityStats(bookings, overrides);
  const alerts: CriticalAlert[] = [];
  const opportunities: Opportunity[] = [];

  // Global leakage
  const totalSpend = stats.reduce((s, c) => s + c.spend, 0);
  const totalOverCap = stats.reduce((s, c) => s + c.overCapSpend, 0);
  const globalLeakagePct = totalSpend > 0 ? (totalOverCap / totalSpend) * 100 : 0;

  if (globalLeakagePct > th.leakagePct) {
    const oppId = `opp-leak-global`;
    alerts.push({
      id: `alert-leak-global`,
      title: `Leakage global em ${fmtPct(globalLeakagePct)}`,
      description: `Reservas acima do cap representam ${fmtUsdShort(totalOverCap)} do spend total.`,
      severity: severityFromGap(globalLeakagePct, th.leakagePct, th.leakagePct + 10),
      metric: `${fmtPct(globalLeakagePct)} do spend`,
      opportunityId: oppId,
    });
  }

  stats.forEach((c) => {
    const cityActions: RecommendedAction[] = [];
    const reasons: string[] = [];
    let oppSavings = 0;
    let oppPriority = "low" as Opportunity["priority"];

    const adrGapPct = c.cap > 0 ? ((c.adr - c.cap) / c.cap) * 100 : 0;
    if (adrGapPct >= th.adrGapPct) {
      const sev = severityFromGap(adrGapPct, th.adrGapPct, th.adrGapPct + 7);
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
        impact: renegSavings, effort: "medium",
        payload: { kind: "renegotiation", data: { city: c.city, hotels: Math.min(5, c.hotelCount), targetAdrReduction: targetReduction } },
      });
      const newCap = Math.round(c.adr * 0.95);
      cityActions.push({
        id: `act-${c.city}-cap`,
        label: `Reduzir city cap de US$ ${c.cap} para US$ ${newCap}`,
        impact: capSavings, effort: "low",
        payload: { kind: "cap_adjustment", data: { city: c.city, fromCap: c.cap, toCap: newCap } },
      });
      reasons.push(`ADR ${fmtPct(adrGapPct)} acima do cap`);
      oppSavings += renegSavings + capSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    if (c.compliancePct < th.compliancePct && c.roomNights > 0) {
      const gap = th.compliancePct - c.compliancePct;
      const sev = severityFromGap(gap, 5, 15);
      const oppId = `opp-${c.city}-comp`;
      alerts.push({
        id: `alert-${c.city}-comp`,
        title: `Compliance de ${c.city} em ${fmtPct(c.compliancePct)}`,
        description: `Abaixo do threshold de ${th.compliancePct}%. Risco de leakage e perda de poder de negociação.`,
        severity: sev,
        metric: `${fmtPct(c.compliancePct)} (meta ${th.compliancePct}%)`,
        opportunityId: oppId,
      });
      const portfolioSavings = Math.round(c.spend * 0.04);
      cityActions.push({
        id: `act-${c.city}-portfolio`,
        label: `Revisar portfólio e remover hotéis fora do programa`,
        impact: portfolioSavings, effort: "high",
        payload: { kind: "cluster_change", data: { city: c.city, hotelsToAdd: 2, toCluster: "Drop" } },
      });
      cityActions.push({
        id: `act-${c.city}-comm`,
        label: `Comunicação dirigida + lembrete no booking tool`,
        impact: Math.round(portfolioSavings * 0.4), effort: "low",
        payload: { kind: "communication", data: { city: c.city, channel: "Email + booking tool" } },
      });
      reasons.push(`compliance em ${fmtPct(c.compliancePct)}`);
      oppSavings += portfolioSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    if (c.overCapPct > th.leakagePct) {
      const oppId = `opp-${c.city}-leak`;
      const sev = severityFromGap(c.overCapPct, th.leakagePct, th.leakagePct + 10);
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
        impact: expandSavings, effort: "medium",
        payload: { kind: "cluster_change", data: { city: c.city, hotelsToAdd: 3, toCluster: "Preferred" } },
      });
      reasons.push(`leakage de ${fmtPct(c.overCapPct)}`);
      oppSavings += expandSavings;
      if (sev === "high") oppPriority = "high";
      else if (oppPriority !== "high") oppPriority = "medium";
    }

    if (c.hotelTop2Share > th.concentrationPct && c.hotelCount >= 2) {
      const oppId = `opp-${c.city}-conc`;
      alerts.push({
        id: `alert-${c.city}-conc`,
        title: `Concentração em ${c.city}: ${fmtPct(c.hotelTop2Share)} em 2 hotéis`,
        description: `Falta competição. Mini-RFP com novos fornecedores reduz dependência.`,
        severity: c.hotelTop2Share > th.concentrationPct + 20 ? "high" : "medium",
        metric: `${fmtPct(c.hotelTop2Share)} em top 2`,
        opportunityId: oppId,
      });
      const rfpSavings = Math.round(c.spend * 0.06);
      cityActions.push({
        id: `act-${c.city}-rfp`,
        label: `Mini-RFP com 4 hotéis adicionais para aumentar competição`,
        impact: rfpSavings, effort: "high",
        payload: { kind: "mini_rfp", data: { city: c.city, hotels: 4 } },
      });
      reasons.push(`${fmtPct(c.hotelTop2Share)} concentrado em 2 hotéis`);
      oppSavings += rfpSavings;
      if (oppPriority !== "high") oppPriority = c.hotelTop2Share > th.concentrationPct + 20 ? "high" : "medium";
    }

    if (cityActions.length > 0 && oppSavings > 0) {
      const linkedAlert = alerts.find((a) => a.opportunityId?.startsWith(`opp-${c.city}-`));
      const oppId = linkedAlert?.opportunityId ?? `opp-${c.city}`;
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

  // Filter executed opportunities (engine learns)
  const filteredOpportunities = opportunities.filter((o) => !executedSet.has(o.id));
  const filteredAlerts = alerts.filter((a) => !a.opportunityId || !executedSet.has(a.opportunityId));

  const sevOrder = { high: 0, medium: 1, low: 2 } as const;
  filteredAlerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  filteredOpportunities.sort((a, b) => b.savings - a.savings);

  return { alerts: filteredAlerts.slice(0, 6), opportunities: filteredOpportunities.slice(0, 6) };
}
