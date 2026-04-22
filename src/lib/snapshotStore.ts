// Snapshot store: simulates continuous evaluation cycles.
// Holds the previous snapshot so the UI can show deltas (NEW alerts/opps,
// % change) versus the prior evaluation.

import { create } from "zustand";
import type { CriticalAlert, Opportunity } from "@/components/dashboard/decisionData";
import { evaluateRules } from "./recommendationEngine";
import { useBaselineStore } from "./baselineStore";
import { useActionStore } from "./actionStore";

export interface Snapshot {
  timestamp: string; // ISO
  alerts: CriticalAlert[];
  opportunities: Opportunity[];
  totalSavings: number;
  bookingCount: number;
}

interface SnapshotState {
  current: Snapshot | null;
  previous: Snapshot | null;
  evaluatedAt: string | null;
  evaluate: () => void;
}

function buildSnapshot(): Snapshot {
  const bookings = useBaselineStore.getState().bookings;
  const capOverrides = useActionStore.getState().capOverrides;
  const { alerts, opportunities } = evaluateRules(bookings, capOverrides);
  return {
    timestamp: new Date().toISOString(),
    alerts,
    opportunities,
    totalSavings: opportunities.reduce((s, o) => s + o.savings, 0),
    bookingCount: bookings.length,
  };
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  current: null,
  previous: null,
  evaluatedAt: null,
  evaluate: () => {
    set((s) => {
      const next = buildSnapshot();
      return {
        previous: s.current,
        current: next,
        evaluatedAt: next.timestamp,
      };
    });
  },
}));

// ============== Delta selectors ==============

export interface AlertDelta {
  isNew: boolean;
  metricChangePct: number | null; // null when no comparable previous
}

export function deltaForAlert(alertId: string, current: Snapshot | null, previous: Snapshot | null): AlertDelta {
  if (!current) return { isNew: false, metricChangePct: null };
  const wasInPrev = previous?.alerts.some((a) => a.id === alertId) ?? false;
  return { isNew: !wasInPrev && previous !== null, metricChangePct: null };
}

export function isOpportunityNew(oppId: string, current: Snapshot | null, previous: Snapshot | null): boolean {
  if (!current || !previous) return false;
  const wasInPrev = previous.opportunities.some((o) => o.id === oppId);
  return !wasInPrev;
}

export function savingsDeltaPct(current: Snapshot | null, previous: Snapshot | null): number | null {
  if (!current || !previous || previous.totalSavings === 0) return null;
  return ((current.totalSavings - previous.totalSavings) / previous.totalSavings) * 100;
}

// Days until next simulated weekly re-evaluation
export function daysUntilNextEval(evaluatedAt: string | null): number {
  if (!evaluatedAt) return 7;
  const last = new Date(evaluatedAt).getTime();
  const next = last + 7 * 24 * 60 * 60 * 1000;
  const remainingMs = next - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
