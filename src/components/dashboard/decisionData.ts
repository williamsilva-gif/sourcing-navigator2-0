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

export const FALLBACK_ALERTS: CriticalAlert[] = [];

export const FALLBACK_OPPORTUNITIES: Opportunity[] = [];

export const IMPACT_TIMELINE: ImpactPoint[] = [];

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
import { useThresholds, useDefaultCap } from "@/lib/appConfigStore";
import { evaluateRules } from "@/lib/recommendationEngine";

import { filterByWindow, type PeriodWindow } from "@/lib/periodFilter";

export function useDecisionData(window?: PeriodWindow | null): { alerts: CriticalAlert[]; opportunities: Opportunity[]; source: "baseline" | "demo" | "empty" } {
  const allBookings = useBaselineStore((s) => s.bookings);
  const bookings = window ? filterByWindow(allBookings, window) : allBookings;
  const useDemo = useBaselineStore((s) => s.useDemo);
  const capOverrides = useActionStore((s) => s.capOverrides);
  const adrAdjustments = useActionStore((s) => s.adrAdjustments);
  const portfolioOverrides = useActionStore((s) => s.portfolioOverrides);
  const marketExpansion = useActionStore((s) => s.marketExpansion);
  const executedOpportunityIds = useActionStore((s) => s.executedOpportunityIds);
  const thresholds = useThresholds();
  const defaultCap = useDefaultCap();

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

// Preview hook — same engine, but accepts ad-hoc thresholds/cap so the UI
// can show "what would change" before persisting new business rules.
import type { Thresholds } from "@/lib/appConfigStore";

export function useDecisionPreview(
  thresholdsOverride: Thresholds,
  defaultCapOverride: number,
): { alerts: CriticalAlert[]; opportunities: Opportunity[]; source: "baseline" | "demo" | "empty" } {
  const bookings = useBaselineStore((s) => s.bookings);
  const useDemo = useBaselineStore((s) => s.useDemo);
  const capOverrides = useActionStore((s) => s.capOverrides);
  const adrAdjustments = useActionStore((s) => s.adrAdjustments);
  const portfolioOverrides = useActionStore((s) => s.portfolioOverrides);
  const marketExpansion = useActionStore((s) => s.marketExpansion);
  const executedOpportunityIds = useActionStore((s) => s.executedOpportunityIds);

  return useMemo(() => {
    if (bookings.length > 0) {
      const { alerts, opportunities } = evaluateRules(bookings, {
        capOverrides,
        adrAdjustments,
        portfolioOverrides,
        marketExpansion,
        executedOpportunityIds,
        thresholds: thresholdsOverride,
        defaultCap: defaultCapOverride,
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
  }, [bookings, capOverrides, adrAdjustments, portfolioOverrides, marketExpansion, executedOpportunityIds, thresholdsOverride, defaultCapOverride, useDemo]);
}

// Backward-compat exports — kept so any non-migrated import keeps building.
export const CRITICAL_ALERTS = FALLBACK_ALERTS;
export const OPPORTUNITIES = FALLBACK_OPPORTUNITIES;

