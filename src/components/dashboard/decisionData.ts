// Centralized mock data for the Continuous Decision Center.
// Each RecommendedAction now carries a typed payload — the dashboard dispatches
// it to the correct module via useActionStore.executeAction().

import type { ActionPayload } from "@/lib/actionStore";

export type Severity = "high" | "medium" | "low";
export type Priority = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";

export interface CriticalAlert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  metric: string;
  opportunityId?: string;
}

export interface RecommendedAction {
  id: string;
  label: string;
  impact: number; // USD
  effort: Effort;
  payload: ActionPayload;
}

export interface Opportunity {
  id: string;
  scope: string; // city or hotel
  region: string;
  savings: number; // USD
  reason: string;
  priority: Priority;
  // Baseline KPI snapshot — used to seed action.kpis on execution
  adrBefore: number;
  complianceBefore: number;
  actions: RecommendedAction[];
}

export interface ImpactPoint {
  month: string;
  expected: number;
  actual: number;
}

// ============================================================================
// Fallback mocks (used when no baseline is loaded)
// ============================================================================

export const FALLBACK_ALERTS: CriticalAlert[] = [
  {
    id: "alert-1",
    title: "Compliance abaixo de 75%",
    description: "Tier 3 (hotéis fora do programa) caiu para 68% de aderência nos últimos 30 dias.",
    severity: "high",
    metric: "68% (meta 90%)",
    opportunityId: "opp-1",
  },
  {
    id: "alert-2",
    title: "Leakage subiu 10% no mês",
    description: "Reservas acima do cap em São Paulo cresceram de US$ 142k para US$ 157k.",
    severity: "high",
    metric: "+US$ 15k vs mês anterior",
    opportunityId: "opp-1",
  },
  {
    id: "alert-3",
    title: "ADR de Mexico City 8% acima do cap",
    description: "Cap negociado: US$ 175. ADR efetivo dos últimos 30 dias: US$ 189.",
    severity: "medium",
    metric: "+US$ 14 / room night",
    opportunityId: "opp-2",
  },
  {
    id: "alert-4",
    title: "3 contratos expiram em 30 dias",
    description: "Hotéis em Bogotá, Lima e Santiago sem renovação iniciada — risco de perda de tarifa.",
    severity: "low",
    metric: "3 contratos",
  },
];

export const FALLBACK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-1",
    scope: "São Paulo",
    region: "LATAM",
    savings: 142000,
    reason: "ADR efetivo 12% acima do cap em 38% das reservas",
    priority: "high",
    adrBefore: 248,
    complianceBefore: 68,
    actions: [
      {
        id: "act-1-1",
        label: "Lançar renegociação com 5 hotéis Tier 2",
        impact: 86000,
        effort: "medium",
        payload: { kind: "renegotiation", data: { city: "São Paulo", hotels: 5, targetAdrReduction: 10 } },
      },
      {
        id: "act-1-2",
        label: "Reduzir city cap de US$ 248 para US$ 220",
        impact: 42000,
        effort: "low",
        payload: { kind: "cap_adjustment", data: { city: "São Paulo", fromCap: 248, toCap: 220 } },
      },
      {
        id: "act-1-3",
        label: "Adicionar 3 hotéis ao RFP para aumentar competição",
        impact: 28000,
        effort: "high",
        payload: { kind: "mini_rfp", data: { city: "São Paulo", hotels: 3 } },
      },
    ],
  },
  {
    id: "opp-2",
    scope: "Mexico City",
    region: "LATAM",
    savings: 96000,
    reason: "Cap desatualizado vs mercado — 3 hotéis Tier 1 fora do programa",
    priority: "high",
    adrBefore: 189,
    complianceBefore: 74,
    actions: [
      {
        id: "act-2-1",
        label: "Atualizar cap de US$ 175 para US$ 195",
        impact: 38000,
        effort: "low",
        payload: { kind: "cap_adjustment", data: { city: "Mexico City", fromCap: 175, toCap: 195 } },
      },
      {
        id: "act-2-2",
        label: "Mini-RFP para 4 hotéis Tier 1 ainda não contratados",
        impact: 58000,
        effort: "medium",
        payload: { kind: "mini_rfp", data: { city: "Mexico City", hotels: 4 } },
      },
    ],
  },
  {
    id: "opp-3",
    scope: "Bogotá",
    region: "LATAM",
    savings: 78000,
    reason: "Concentração de 71% em 2 hotéis sem alternativa de tarifa",
    priority: "medium",
    adrBefore: 165,
    complianceBefore: 81,
    actions: [
      {
        id: "act-3-1",
        label: "Adicionar 4 hotéis Midscale como Preferred",
        impact: 52000,
        effort: "high",
        payload: { kind: "cluster_change", data: { city: "Bogotá", hotelsToAdd: 4, toCluster: "Preferred" } },
      },
      {
        id: "act-3-2",
        label: "Renegociar volume com hotel principal (40% do spend)",
        impact: 26000,
        effort: "medium",
        payload: { kind: "renegotiation", data: { city: "Bogotá", hotels: 1, targetAdrReduction: 8 } },
      },
    ],
  },
  {
    id: "opp-4",
    scope: "Buenos Aires",
    region: "LATAM",
    savings: 64000,
    reason: "Variação de ADR entre hotéis do mesmo tier acima de 18%",
    priority: "medium",
    adrBefore: 218,
    complianceBefore: 79,
    actions: [
      {
        id: "act-4-1",
        label: "Alinhar caps por tier — Upscale para US$ 178",
        impact: 38000,
        effort: "low",
        payload: { kind: "cap_adjustment", data: { city: "Buenos Aires", fromCap: 218, toCap: 178 } },
      },
      {
        id: "act-4-2",
        label: "Renegociar com 2 hotéis acima da média do tier",
        impact: 26000,
        effort: "medium",
        payload: { kind: "renegotiation", data: { city: "Buenos Aires", hotels: 2, targetAdrReduction: 7 } },
      },
    ],
  },
  {
    id: "opp-5",
    scope: "Lima",
    region: "LATAM",
    savings: 32000,
    reason: "12% das reservas em hotéis fora do programa (leakage)",
    priority: "low",
    adrBefore: 142,
    complianceBefore: 72,
    actions: [
      {
        id: "act-5-1",
        label: "Comunicação dirigida + lembrete no booking tool",
        impact: 18000,
        effort: "low",
        payload: { kind: "communication", data: { city: "Lima", channel: "Email + booking tool" } },
      },
      {
        id: "act-5-2",
        label: "Adicionar 2 hotéis preferred no centro",
        impact: 14000,
        effort: "medium",
        payload: { kind: "cluster_change", data: { city: "Lima", hotelsToAdd: 2, toCluster: "Preferred" } },
      },
    ],
  },
];

export const IMPACT_TIMELINE: ImpactPoint[] = [
  { month: "Mai", expected: 0, actual: 0 },
  { month: "Jun", expected: 38, actual: 32 },
  { month: "Jul", expected: 76, actual: 71 },
  { month: "Ago", expected: 124, actual: 118 },
  { month: "Set", expected: 168, actual: 174 },
  { month: "Out", expected: 212, actual: 224 },
];

export function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `US$ ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `US$ ${Math.round(value / 1000)}k`;
  return `US$ ${value}`;
}

// ============================================================================
// Hook: returns derived alerts/opportunities when baseline exists,
// otherwise falls back to the curated mocks above.
// ============================================================================

import { useMemo } from "react";
import { useBaselineStore } from "@/lib/baselineStore";
import { useActionStore } from "@/lib/actionStore";
import { useAppConfigStore } from "@/lib/appConfigStore";
import { evaluateRules } from "@/lib/recommendationEngine";

export function useDecisionData(): { alerts: CriticalAlert[]; opportunities: Opportunity[]; source: "baseline" | "demo" | "empty" } {
  const bookings = useBaselineStore((s) => s.bookings);
  const useDemo = useBaselineStore((s) => s.useDemo);
  const capOverrides = useActionStore((s) => s.capOverrides);
  const adrAdjustments = useActionStore((s) => s.adrAdjustments);
  const portfolioOverrides = useActionStore((s) => s.portfolioOverrides);
  const marketExpansion = useActionStore((s) => s.marketExpansion);
  const executedOpportunityIds = useActionStore((s) => s.executedOpportunityIds);
  const thresholds = useAppConfigStore((s) => s.thresholds);
  const defaultCap = useAppConfigStore((s) => s.defaultCap);

  return useMemo(() => {
    if (bookings.length > 0) {
      const { alerts, opportunities } = evaluateRules(bookings, {
        capOverrides,
        adrAdjustments,
        portfolioOverrides,
        marketExpansion,
        executedOpportunityIds,
        thresholds,
        defaultCap,
      });
      return { alerts, opportunities, source: "baseline" };
    }
    if (useDemo) {
      const executed = new Set(executedOpportunityIds);
      return {
        alerts: FALLBACK_ALERTS.filter((a) => !a.opportunityId || !executed.has(a.opportunityId)),
        opportunities: FALLBACK_OPPORTUNITIES.filter((o) => !executed.has(o.id)),
        source: "demo",
      };
    }
    return { alerts: [], opportunities: [], source: "empty" };
  }, [bookings, capOverrides, adrAdjustments, portfolioOverrides, marketExpansion, executedOpportunityIds, thresholds, defaultCap, useDemo]);
}

// Backward-compat exports — kept so any non-migrated import keeps building.
export const CRITICAL_ALERTS = FALLBACK_ALERTS;
export const OPPORTUNITIES = FALLBACK_OPPORTUNITIES;

