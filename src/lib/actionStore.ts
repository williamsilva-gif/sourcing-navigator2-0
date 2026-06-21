import { create } from "zustand";

/**
 * IMPORTANTE: ações executadas vivem na tabela `client_actions` no banco.
 * NÃO reintroduzir middleware `persist`/localStorage aqui — fonte da verdade
 * é o DB. Cache em LS criava janelas de inconsistência entre dispositivos.
 */
import { createActionFn, updateActionFn, listActionsFn, deleteActionFn } from "./actions.functions";
import { useClientsStore } from "./clientsStore";


// ============================================================================
// Types
// ============================================================================

export type ActionKind =
  | "renegotiation" // create batch in /negociacao
  | "cap_adjustment" // update city cap in /estrategia
  | "cluster_change" // move hotels between clusters in /estrategia
  | "mini_rfp" // create mini-RFP in /rfp
  | "communication"; // soft action — communication / training

export type ActionStatus = "initiated" | "in_progress" | "completed";

export type Effort = "low" | "medium" | "high";

export interface RenegotiationPayload {
  city: string;
  hotels: number; // how many hotels in batch
  targetAdrReduction: number; // % reduction target
}

export interface CapAdjustmentPayload {
  city: string;
  fromCap: number;
  toCap: number;
}

export interface ClusterChangePayload {
  city: string;
  hotelsToAdd: number;
  toCluster: "Strategic" | "Preferred" | "Tactical" | "Drop";
}

export interface MiniRfpPayload {
  city: string;
  hotels: number;
}

export interface CommunicationPayload {
  city: string;
  channel: string;
}

export type ActionPayload =
  | { kind: "renegotiation"; data: RenegotiationPayload }
  | { kind: "cap_adjustment"; data: CapAdjustmentPayload }
  | { kind: "cluster_change"; data: ClusterChangePayload }
  | { kind: "mini_rfp"; data: MiniRfpPayload }
  | { kind: "communication"; data: CommunicationPayload };

export interface ActionKpis {
  adrBefore: number;
  adrAfter: number; // current measurement, evolves over time
  complianceBefore: number; // %
  complianceAfter: number;
  savingsExpected: number; // USD
  savingsRealized: number; // USD, grows as status advances
}

export interface ExecutedAction {
  id: string;
  opportunityId: string;
  label: string;
  kind: ActionKind;
  payload: ActionPayload;
  status: ActionStatus;
  effort: Effort;
  city: string;
  module: "negociacao" | "estrategia" | "rfp" | "selecao";
  createdAt: string; // ISO
  updatedAt: string;
  kpis: ActionKpis;
}

// ============================================================================
// Store
// ============================================================================

export interface PortfolioOverride {
  addedHotels: number;
  cluster: string;
}

interface ActionStoreState {
  actions: ExecutedAction[];
  // Derived overrides applied to other modules
  capOverrides: Record<string, number>;
  // % ADR reduction by city (negative number, e.g. -10 = -10%)
  adrAdjustments: Record<string, number>;
  // Hotels added per city via cluster_change
  portfolioOverrides: Record<string, PortfolioOverride>;
  // Cities with active mini-RFP (reduces concentration)
  marketExpansion: Record<string, boolean>;
  // Opportunity ids already addressed (engine dedupe)
  executedOpportunityIds: string[];

  clusterMoves: Array<{ city: string; hotels: number; toCluster: string; actionId: string }>;
  negotiationBatches: Array<{
    id: string;
    city: string;
    hotels: number;
    targetAdrReduction: number;
    actionId: string;
    createdAt: string;
  }>;
  miniRfps: Array<{ id: string; city: string; hotels: number; actionId: string }>;

  executeAction: (input: {
    opportunityId: string;
    label: string;
    payload: ActionPayload;
    effort: Effort;
    savingsExpected: number;
    adrBefore: number;
    complianceBefore: number;
  }) => ExecutedAction;

  advanceStatus: (id: string) => void;
  resetAll: () => void;
  hydratedForTenant: string | null;
  hydrateFromDb: (clientTenantId: string) => Promise<void>;
}

function uid(prefix: string) {
  // Use uuid v4 so the same id round-trips to the DB
  const u =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix === "act" ? u : `${prefix}-${u.slice(0, 8)}`;
}

function moduleForKind(kind: ActionKind): ExecutedAction["module"] {
  switch (kind) {

    case "renegotiation":
      return "negociacao";
    case "cap_adjustment":
    case "cluster_change":
    case "communication":
      return "estrategia";
    case "mini_rfp":
      return "rfp";
  }
}

function cityFromPayload(payload: ActionPayload): string {
  return payload.data.city;
}

export const useActionStore = create<ActionStoreState>()((set, get) => ({
  actions: [],
  capOverrides: {},
  adrAdjustments: {},
  portfolioOverrides: {},
  marketExpansion: {},
  executedOpportunityIds: [],
  clusterMoves: [],
  negotiationBatches: [],
  miniRfps: [],

  hydratedForTenant: null,

  hydrateFromDb: async (clientTenantId: string) => {
    try {
      const rows = await listActionsFn({ data: { clientTenantId } });
      // Replay rows oldest → newest so derived overrides reflect final state
      const ordered = [...rows].sort((a, b) =>
        (a.created_at as string).localeCompare(b.created_at as string),
      );
      const actions: ExecutedAction[] = [];
      const capOverrides: Record<string, number> = {};
      const adrAdjustments: Record<string, number> = {};
      const portfolioOverrides: Record<string, PortfolioOverride> = {};
      const marketExpansion: Record<string, boolean> = {};
      const executedOpportunityIds: string[] = [];
      const clusterMoves: ActionStoreState["clusterMoves"] = [];
      const negotiationBatches: ActionStoreState["negotiationBatches"] = [];
      const miniRfps: ActionStoreState["miniRfps"] = [];

      for (const r of ordered) {
        const payload = r.payload as unknown as ActionPayload;
        const kpis = r.kpis as unknown as ActionKpis;
        const action: ExecutedAction = {
          id: r.id as string,
          opportunityId: (r.opportunity_id as string) ?? "",
          label: r.label as string,
          kind: r.kind as ActionKind,
          payload,
          status: r.status as ActionStatus,
          effort: r.effort as Effort,
          city: (r.city as string) ?? payload?.data?.city ?? "",
          module: r.module as ExecutedAction["module"],
          createdAt: r.created_at as string,
          updatedAt: r.updated_at as string,
          kpis,
        };
        actions.unshift(action); // newest first in store
        if (action.opportunityId && !executedOpportunityIds.includes(action.opportunityId)) {
          executedOpportunityIds.push(action.opportunityId);
        }
        if (payload?.kind === "cap_adjustment") {
          capOverrides[payload.data.city] = payload.data.toCap;
        } else if (payload?.kind === "cluster_change") {
          const prev = portfolioOverrides[payload.data.city];
          portfolioOverrides[payload.data.city] = {
            addedHotels: (prev?.addedHotels ?? 0) + payload.data.hotelsToAdd,
            cluster: payload.data.toCluster,
          };
          clusterMoves.push({
            city: payload.data.city,
            hotels: payload.data.hotelsToAdd,
            toCluster: payload.data.toCluster,
            actionId: action.id,
          });
        } else if (payload?.kind === "renegotiation") {
          const existing = adrAdjustments[payload.data.city] ?? 0;
          adrAdjustments[payload.data.city] = Math.max(
            -40,
            existing - payload.data.targetAdrReduction,
          );
          negotiationBatches.push({
            id: uid("batch"),
            city: payload.data.city,
            hotels: payload.data.hotels,
            targetAdrReduction: payload.data.targetAdrReduction,
            actionId: action.id,
            createdAt: action.createdAt,
          });
        } else if (payload?.kind === "mini_rfp") {
          marketExpansion[payload.data.city] = true;
          miniRfps.push({
            id: uid("rfp"),
            city: payload.data.city,
            hotels: payload.data.hotels,
            actionId: action.id,
          });
        }
      }

      set({
        actions,
        capOverrides,
        adrAdjustments,
        portfolioOverrides,
        marketExpansion,
        executedOpportunityIds,
        clusterMoves,
        negotiationBatches,
        miniRfps,
        hydratedForTenant: clientTenantId,
      });
    } catch (err) {
      console.error("[actionStore] hydrateFromDb failed", err);
    }
  },

  executeAction: ({ opportunityId, label, payload, effort, savingsExpected, adrBefore, complianceBefore }) => {
    const kind = payload.kind;
    const id = uid("act");
    const now = new Date().toISOString();
    const city = cityFromPayload(payload);

    const action: ExecutedAction = {
      id,
      opportunityId,
      label,
      kind,
      payload,
      status: "initiated",
      effort,
      city,
      module: moduleForKind(kind),
      createdAt: now,
      updatedAt: now,
      kpis: {
        adrBefore,
        adrAfter: adrBefore, // no movement yet
        complianceBefore,
        complianceAfter: complianceBefore,
        savingsExpected,
        savingsRealized: 0,
      },
    };

    set((s) => {
      const next: Partial<ActionStoreState> = {
        actions: [action, ...s.actions],
        executedOpportunityIds: s.executedOpportunityIds.includes(opportunityId)
          ? s.executedOpportunityIds
          : [...s.executedOpportunityIds, opportunityId],
      };

      if (payload.kind === "cap_adjustment") {
        next.capOverrides = { ...s.capOverrides, [payload.data.city]: payload.data.toCap };
      }
      if (payload.kind === "cluster_change") {
        const prev = s.portfolioOverrides[payload.data.city];
        next.portfolioOverrides = {
          ...s.portfolioOverrides,
          [payload.data.city]: {
            addedHotels: (prev?.addedHotels ?? 0) + payload.data.hotelsToAdd,
            cluster: payload.data.toCluster,
          },
        };
        next.clusterMoves = [
          ...s.clusterMoves,
          {
            city: payload.data.city,
            hotels: payload.data.hotelsToAdd,
            toCluster: payload.data.toCluster,
            actionId: id,
          },
        ];
      }
      if (payload.kind === "renegotiation") {
        const existing = s.adrAdjustments[payload.data.city] ?? 0;
        const combined = Math.max(-40, existing - payload.data.targetAdrReduction);
        next.adrAdjustments = { ...s.adrAdjustments, [payload.data.city]: combined };
        next.negotiationBatches = [
          ...s.negotiationBatches,
          {
            id: uid("batch"),
            city: payload.data.city,
            hotels: payload.data.hotels,
            targetAdrReduction: payload.data.targetAdrReduction,
            actionId: id,
            createdAt: now,
          },
        ];
      }
      if (payload.kind === "mini_rfp") {
        next.marketExpansion = { ...s.marketExpansion, [payload.data.city]: true };
        next.miniRfps = [
          ...s.miniRfps,
          { id: uid("rfp"), city: payload.data.city, hotels: payload.data.hotels, actionId: id },
        ];
      }

      return next as ActionStoreState;
    });

    // Persist to DB (best-effort) using the currently selected tenant
    const tenantId = useClientsStore.getState().selectedClientId;
    if (tenantId) {
      createActionFn({
        data: {
          id,
          clientTenantId: tenantId,
          opportunityId,
          label,
          kind,
          module: action.module,
          city,
          effort,
          status: "initiated",
          payload: payload as unknown as Record<string, unknown>,
          kpis: action.kpis as unknown as Record<string, unknown>,
        },
      }).catch((e) => console.error("[actionStore] createActionFn failed", e));
    }

    // Auto-advance: initiated → in_progress after 600ms (simulates async dispatch)
    setTimeout(() => get().advanceStatus(id), 600);

    return action;
  },

  advanceStatus: (id) => {
    let updated: ExecutedAction | undefined;
    set((s) => ({
      actions: s.actions.map((a) => {
        if (a.id !== id) return a;
        if (a.status === "completed") return a;
        const nextStatus: ActionStatus = a.status === "initiated" ? "in_progress" : "completed";

        // Project KPI evolution based on status
        const factor = nextStatus === "in_progress" ? 0.4 : 0.95; // % of expected impact realized

        // Simulated ADR drop & compliance lift proportional to factor
        const adrTargetDelta = (() => {
          if (a.payload.kind === "cap_adjustment") {
            return a.payload.data.toCap - a.payload.data.fromCap; // negative if reducing
          }
          if (a.payload.kind === "renegotiation") {
            return -a.kpis.adrBefore * (a.payload.data.targetAdrReduction / 100);
          }
          if (a.payload.kind === "mini_rfp") {
            return -a.kpis.adrBefore * 0.06; // ~6% from competitive pressure
          }
          if (a.payload.kind === "cluster_change") {
            return -a.kpis.adrBefore * 0.03;
          }
          return -a.kpis.adrBefore * 0.02; // communication
        })();

        const complianceLift = a.payload.kind === "communication" ? 12 : 6;

        const next: ExecutedAction = {
          ...a,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          kpis: {
            ...a.kpis,
            adrAfter: Math.round((a.kpis.adrBefore + adrTargetDelta * factor) * 100) / 100,
            complianceAfter: Math.min(100, Math.round((a.kpis.complianceBefore + complianceLift * factor) * 10) / 10),
            savingsRealized: Math.round(a.kpis.savingsExpected * factor),
          },
        };
        updated = next;
        return next;
      }),
    }));

    // Persist status/kpis update (only for proper UUID ids that round-trip to DB)
    if (updated && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      updateActionFn({
        data: {
          id,
          status: updated.status,
          kpis: updated.kpis as unknown as Record<string, unknown>,
        },
      }).catch((e) => console.error("[actionStore] updateActionFn failed", e));
    }
  },

  resetAll: () => {
    const ids = get().actions.map((a) => a.id);
    set({
      actions: [],
      capOverrides: {},
      adrAdjustments: {},
      portfolioOverrides: {},
      marketExpansion: {},
      executedOpportunityIds: [],
      clusterMoves: [],
      negotiationBatches: [],
      miniRfps: [],
    });
    // Best-effort delete from DB
    for (const id of ids) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        deleteActionFn({ data: { id } }).catch(() => {});
      }
    }
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export function selectByModule(actions: ExecutedAction[], module: ExecutedAction["module"]) {
  return actions.filter((a) => a.module === module);
}

export function selectActiveCount(actions: ExecutedAction[]) {
  return actions.filter((a) => a.status !== "completed").length;
}

export function selectTotalRealized(actions: ExecutedAction[]) {
  return actions.reduce((s, a) => s + a.kpis.savingsRealized, 0);
}

export function selectTotalExpected(actions: ExecutedAction[]) {
  return actions.reduce((s, a) => s + a.kpis.savingsExpected, 0);
}
