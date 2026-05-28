import { create } from "zustand";
import {
  upsertAlertsFn,
  listAlertsFn,
  setAlertStatusFn,
  createDecisionActionFn,
  setActionStatusFn,
  listActionsFn,
  listWatchlistFn,
  setWatchlistPinnedFn,
  addFollowUpFn,
  completeFollowUpFn,
  listFollowUpsFn,
  addCommentFn,
  listCommentsFn,
  createAttachmentUploadUrlFn,
  recordAttachmentFn,
  listAttachmentsFn,
} from "./decision.functions";

// ============================================================================
// Domain types (mirror DB rows)
// ============================================================================

export type AlertType =
  | "ADR_VARIANCE"
  | "SMART_LEAKAGE"
  | "RATE_LOADING"
  | "HOTEL_UNDERPERFORMANCE"
  | "HOTEL_DEPENDENCY"
  | "SAVINGS_MISSED";

export type AlertSeverity = "high" | "medium" | "low";
export type AlertStatus = "open" | "in_progress" | "dismissed" | "completed";

export interface DecisionAlert {
  id: string;
  client_tenant_id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  impacted_city: string | null;
  impacted_hotel: string | null;
  financial_impact: number;
  status: AlertStatus;
  dismissed_at: string | null;
  completed_at: string | null;
  signature: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ActionType =
  | "SEND_ALERT"
  | "FOLLOW_UP"
  | "IGNORE"
  | "OPEN_MINI_RFP"
  | "ADD_TO_PIPELINE";

export type ActionStatus =
  | "PENDING"
  | "SENT"
  | "WAITING_RESPONSE"
  | "RESPONDED"
  | "COMPLETED"
  | "IGNORED";

export interface DecisionAction {
  id: string;
  client_tenant_id: string;
  alert_id: string | null;
  type: ActionType;
  status: ActionStatus;
  assigned_to: string | null;
  email_recipients: string[] | null;
  payload: Record<string, unknown>;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  client_tenant_id: string;
  action_id: string;
  pinned: boolean;
  due_at: string | null;
  last_activity_at: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  client_tenant_id: string;
  action_id: string;
  kind: "email" | "call" | "meeting" | "note";
  scheduled_at: string | null;
  executed_at: string | null;
  outcome: "pending" | "done" | "no_response" | "cancelled";
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionComment {
  id: string;
  client_tenant_id: string;
  action_id: string | null;
  alert_id: string | null;
  body: string;
  author_id: string | null;
  created_at: string;
}

export interface DecisionAttachment {
  id: string;
  client_tenant_id: string;
  action_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

// ============================================================================
// Store
// ============================================================================

interface DecisionStoreState {
  hydratedForTenant: string | null;
  loading: boolean;

  alerts: DecisionAlert[];
  actions: DecisionAction[];
  watchlist: WatchlistItem[];

  // Per-action detail caches
  followUpsByAction: Record<string, FollowUp[]>;
  commentsByAction: Record<string, DecisionComment[]>;
  commentsByAlert: Record<string, DecisionComment[]>;
  attachmentsByAction: Record<string, DecisionAttachment[]>;

  hydrate: (clientTenantId: string, opts?: { force?: boolean }) => Promise<void>;

  // Alerts
  upsertDerivedAlerts: (
    clientTenantId: string,
    alerts: Array<{
      signature: string;
      type: AlertType;
      severity: AlertSeverity;
      title: string;
      description?: string;
      impactedCity?: string | null;
      impactedHotel?: string | null;
      financialImpact?: number;
      metadata?: Record<string, unknown>;
    }>,
  ) => Promise<void>;
  setAlertStatus: (alertId: string, status: AlertStatus) => Promise<void>;

  // Actions
  createAction: (input: {
    clientTenantId: string;
    alertId?: string | null;
    type: ActionType;
    payload?: Record<string, unknown>;
    assignedTo?: string | null;
    emailRecipients?: string[];
    status?: ActionStatus;
  }) => Promise<DecisionAction>;
  setActionStatus: (actionId: string, status: ActionStatus) => Promise<void>;

  // Watchlist
  setWatchlistPinned: (itemId: string, pinned: boolean) => Promise<void>;

  // Follow-ups
  loadFollowUps: (actionId: string) => Promise<void>;
  addFollowUp: (input: {
    clientTenantId: string;
    actionId: string;
    kind: FollowUp["kind"];
    scheduledAt?: string | null;
    notes?: string;
  }) => Promise<FollowUp>;
  completeFollowUp: (
    followUpId: string,
    actionId: string,
    outcome: FollowUp["outcome"],
    notes?: string,
  ) => Promise<void>;

  // Comments
  loadComments: (opts: { actionId?: string; alertId?: string }) => Promise<void>;
  addComment: (input: {
    clientTenantId: string;
    body: string;
    actionId?: string;
    alertId?: string;
  }) => Promise<DecisionComment>;

  // Attachments
  loadAttachments: (actionId: string) => Promise<void>;
  uploadAttachment: (input: {
    clientTenantId: string;
    actionId: string;
    file: File;
  }) => Promise<DecisionAttachment>;

  reset: () => void;
}

const initial = {
  hydratedForTenant: null as string | null,
  loading: false,
  alerts: [] as DecisionAlert[],
  actions: [] as DecisionAction[],
  watchlist: [] as WatchlistItem[],
  followUpsByAction: {} as Record<string, FollowUp[]>,
  commentsByAction: {} as Record<string, DecisionComment[]>,
  commentsByAlert: {} as Record<string, DecisionComment[]>,
  attachmentsByAction: {} as Record<string, DecisionAttachment[]>,
};

export const useDecisionStore = create<DecisionStoreState>()((set, get) => ({
  ...initial,

  hydrate: async (clientTenantId, opts) => {
    const state = get();
    if (!opts?.force && state.hydratedForTenant === clientTenantId) return;
    set({ loading: true });
    try {
      const [alerts, actions, watchlist] = await Promise.all([
        listAlertsFn({ data: { clientTenantId } }),
        listActionsFn({ data: { clientTenantId } }),
        listWatchlistFn({ data: { clientTenantId } }),
      ]);
      set({
        alerts: alerts as unknown as DecisionAlert[],
        actions: actions as unknown as DecisionAction[],
        watchlist: watchlist as unknown as WatchlistItem[],
        hydratedForTenant: clientTenantId,
        loading: false,
      });
    } catch (err) {
      console.error("[decisionStore] hydrate failed", err);
      set({ loading: false });
    }
  },

  upsertDerivedAlerts: async (clientTenantId, alerts) => {
    if (alerts.length === 0) return;
    try {
      await upsertAlertsFn({
        data: {
          clientTenantId,
          alerts: alerts.map((a) => ({
            signature: a.signature,
            type: a.type,
            severity: a.severity,
            title: a.title,
            description: a.description ?? "",
            impactedCity: a.impactedCity ?? null,
            impactedHotel: a.impactedHotel ?? null,
            financialImpact: a.financialImpact ?? 0,
            metadata: a.metadata ?? {},
          })),
        },
      });
      // Re-fetch only the alerts (keeps actions/watchlist intact)
      const fresh = await listAlertsFn({ data: { clientTenantId } });
      set({ alerts: fresh as unknown as DecisionAlert[] });
    } catch (err) {
      console.error("[decisionStore] upsertDerivedAlerts failed", err);
    }
  },

  setAlertStatus: async (alertId, status) => {
    // Optimistic patch
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, status } : a)),
    }));
    try {
      await setAlertStatusFn({ data: { alertId, status } });
    } catch (err) {
      console.error("[decisionStore] setAlertStatus failed", err);
    }
  },

  createAction: async (input) => {
    const row = (await createDecisionActionFn({
      data: {
        clientTenantId: input.clientTenantId,
        alertId: input.alertId ?? null,
        type: input.type,
        payload: input.payload ?? {},
        assignedTo: input.assignedTo ?? null,
        emailRecipients: input.emailRecipients,
        status: input.status,
      },
    })) as unknown as DecisionAction;
    set((s) => ({ actions: [row, ...s.actions] }));
    // Watchlist row is created by trigger — refresh just that list
    try {
      const watchlist = (await listWatchlistFn({
        data: { clientTenantId: input.clientTenantId },
      })) as unknown as WatchlistItem[];
      set({ watchlist });
    } catch (err) {
      console.error("[decisionStore] watchlist refresh failed", err);
    }
    return row;
  },

  setActionStatus: async (actionId, status) => {
    set((s) => ({
      actions: s.actions.map((a) =>
        a.id === actionId
          ? { ...a, status, completed_at: status === "COMPLETED" || status === "IGNORED" ? new Date().toISOString() : a.completed_at }
          : a,
      ),
    }));
    try {
      await setActionStatusFn({ data: { actionId, status } });
    } catch (err) {
      console.error("[decisionStore] setActionStatus failed", err);
    }
  },

  setWatchlistPinned: async (itemId, pinned) => {
    set((s) => ({
      watchlist: s.watchlist.map((w) => (w.id === itemId ? { ...w, pinned } : w)),
    }));
    try {
      await setWatchlistPinnedFn({ data: { itemId, pinned } });
    } catch (err) {
      console.error("[decisionStore] setWatchlistPinned failed", err);
    }
  },

  loadFollowUps: async (actionId) => {
    try {
      const rows = (await listFollowUpsFn({ data: { actionId } })) as unknown as FollowUp[];
      set((s) => ({ followUpsByAction: { ...s.followUpsByAction, [actionId]: rows } }));
    } catch (err) {
      console.error("[decisionStore] loadFollowUps failed", err);
    }
  },

  addFollowUp: async (input) => {
    const row = (await addFollowUpFn({
      data: {
        clientTenantId: input.clientTenantId,
        actionId: input.actionId,
        kind: input.kind,
        scheduledAt: input.scheduledAt ?? null,
        notes: input.notes ?? "",
      },
    })) as unknown as FollowUp;
    set((s) => ({
      followUpsByAction: {
        ...s.followUpsByAction,
        [input.actionId]: [row, ...(s.followUpsByAction[input.actionId] ?? [])],
      },
    }));
    return row;
  },

  completeFollowUp: async (followUpId, actionId, outcome, notes) => {
    try {
      await completeFollowUpFn({ data: { followUpId, outcome, notes } });
      // Refresh that action's follow-ups
      await get().loadFollowUps(actionId);
    } catch (err) {
      console.error("[decisionStore] completeFollowUp failed", err);
    }
  },

  loadComments: async ({ actionId, alertId }) => {
    try {
      const rows = (await listCommentsFn({ data: { actionId, alertId } })) as unknown as DecisionComment[];
      set((s) => {
        if (actionId) return { commentsByAction: { ...s.commentsByAction, [actionId]: rows } };
        if (alertId) return { commentsByAlert: { ...s.commentsByAlert, [alertId]: rows } };
        return {};
      });
    } catch (err) {
      console.error("[decisionStore] loadComments failed", err);
    }
  },

  addComment: async (input) => {
    const row = (await addCommentFn({
      data: {
        clientTenantId: input.clientTenantId,
        actionId: input.actionId ?? null,
        alertId: input.alertId ?? null,
        body: input.body,
      },
    })) as unknown as DecisionComment;
    set((s) => {
      if (input.actionId) {
        return {
          commentsByAction: {
            ...s.commentsByAction,
            [input.actionId]: [...(s.commentsByAction[input.actionId] ?? []), row],
          },
        };
      }
      if (input.alertId) {
        return {
          commentsByAlert: {
            ...s.commentsByAlert,
            [input.alertId]: [...(s.commentsByAlert[input.alertId] ?? []), row],
          },
        };
      }
      return {};
    });
    return row;
  },

  loadAttachments: async (actionId) => {
    try {
      const rows = (await listAttachmentsFn({ data: { actionId } })) as unknown as DecisionAttachment[];
      set((s) => ({ attachmentsByAction: { ...s.attachmentsByAction, [actionId]: rows } }));
    } catch (err) {
      console.error("[decisionStore] loadAttachments failed", err);
    }
  },

  uploadAttachment: async ({ clientTenantId, actionId, file }) => {
    // 1. Sign URL
    const signed = (await createAttachmentUploadUrlFn({
      data: { clientTenantId, actionId, filename: file.name },
    })) as { signedUrl: string; token: string; path: string };

    // 2. Upload bytes via Storage SDK on the browser client
    const { supabase } = await import("@/integrations/supabase/client");
    const up = await supabase.storage
      .from("baseline-files")
      .uploadToSignedUrl(signed.path, signed.token, file);
    if (up.error) throw new Error(up.error.message);

    // 3. Record metadata
    const meta = (await recordAttachmentFn({
      data: {
        clientTenantId,
        actionId,
        storagePath: signed.path,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    })) as unknown as DecisionAttachment;

    set((s) => ({
      attachmentsByAction: {
        ...s.attachmentsByAction,
        [actionId]: [meta, ...(s.attachmentsByAction[actionId] ?? [])],
      },
    }));
    return meta;
  },

  reset: () => set({ ...initial }),
}));

// ============================================================================
// Pure selectors (use outside React or inside useMemo)
// ============================================================================

export function selectOpenAlerts(alerts: DecisionAlert[]) {
  return alerts.filter((a) => a.status === "open" || a.status === "in_progress");
}

export function selectActionsForAlert(actions: DecisionAction[], alertId: string) {
  return actions.filter((a) => a.alert_id === alertId);
}

export function selectActiveWatchlist(items: WatchlistItem[], actions: DecisionAction[]) {
  const open = new Set(
    actions.filter((a) => a.status !== "COMPLETED" && a.status !== "IGNORED").map((a) => a.id),
  );
  return items.filter((w) => open.has(w.action_id));
}
