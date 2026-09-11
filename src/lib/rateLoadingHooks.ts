// React Query hooks for Rate Loading Check. All reads/writes go through
// authenticated server functions; the browser never sees portal credentials.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createCampaignFn,
  deriveFinalTermsFn,
  disablePortalConnectionFn,
  getCampaignDetailFn,
  getEntitlementFn,
  getEvidenceUrlFn,
  getRateLoadingOverviewFn,
  listCampaignsFn,
  listEligibleHotelsFn,
  listPortalConnectionsFn,
  previewCampaignFn,
  requestConnectionTestFn,
  rerunChecksFn,
  savePortalConnectionFn,
  setEntitlementFn,
  setPortalCredentialFn,
  updateFinalTermsFn,
  type CreateCampaignInput,
} from "@/lib/rateLoading.functions";

const enabledTenant = (tenantId: string | null | undefined) =>
  !!tenantId && tenantId !== "__ta_workspace__";

export function useRateLoadingOverview(tenantId: string | null | undefined) {
  const fn = useServerFn(getRateLoadingOverviewFn);
  return useQuery({
    queryKey: ["rl-overview", tenantId],
    queryFn: () => fn({ data: { tenantId: tenantId! } }),
    enabled: enabledTenant(tenantId),
    refetchInterval: 15_000,
  });
}

export function usePortalConnections(tenantId: string | null | undefined) {
  const fn = useServerFn(listPortalConnectionsFn);
  return useQuery({
    queryKey: ["rl-connections", tenantId],
    queryFn: () => fn({ data: { tenantId: tenantId! } }),
    enabled: enabledTenant(tenantId),
  });
}

export function useEligibleHotels(tenantId: string | null | undefined) {
  const fn = useServerFn(listEligibleHotelsFn);
  return useQuery({
    queryKey: ["rl-eligible", tenantId],
    queryFn: () => fn({ data: { tenantId: tenantId! } }),
    enabled: enabledTenant(tenantId),
  });
}

export function useCampaigns(tenantId: string | null | undefined) {
  const fn = useServerFn(listCampaignsFn);
  return useQuery({
    queryKey: ["rl-campaigns", tenantId],
    queryFn: () => fn({ data: { tenantId: tenantId! } }),
    enabled: enabledTenant(tenantId),
    refetchInterval: 15_000,
  });
}

export function useCampaignDetail(campaignId: string | null) {
  const fn = useServerFn(getCampaignDetailFn);
  return useQuery({
    queryKey: ["rl-campaign", campaignId],
    queryFn: () => fn({ data: { campaignId: campaignId! } }),
    enabled: !!campaignId,
    refetchInterval: 15_000,
  });
}

export function useEntitlement(tenantId: string | null | undefined) {
  const fn = useServerFn(getEntitlementFn);
  return useQuery({
    queryKey: ["rl-entitlement", tenantId],
    queryFn: () => fn({ data: { tenantId: tenantId! } }),
    enabled: enabledTenant(tenantId),
  });
}

export function useRateLoadingMutations(tenantId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rl-overview", tenantId] });
    qc.invalidateQueries({ queryKey: ["rl-connections", tenantId] });
    qc.invalidateQueries({ queryKey: ["rl-campaigns", tenantId] });
    qc.invalidateQueries({ queryKey: ["rl-eligible", tenantId] });
    qc.invalidateQueries({ queryKey: ["rl-entitlement", tenantId] });
  };

  const saveConnection = useServerFn(savePortalConnectionFn);
  const setCredential = useServerFn(setPortalCredentialFn);
  const disableConnection = useServerFn(disablePortalConnectionFn);
  const testConnection = useServerFn(requestConnectionTestFn);
  const deriveTerms = useServerFn(deriveFinalTermsFn);
  const updateTerms = useServerFn(updateFinalTermsFn);
  const preview = useServerFn(previewCampaignFn);
  const createCampaign = useServerFn(createCampaignFn);
  const rerun = useServerFn(rerunChecksFn);
  const setEntitlement = useServerFn(setEntitlementFn);
  const evidenceUrl = useServerFn(getEvidenceUrlFn);

  return {
    saveConnection: useMutation({
      mutationFn: (data: Parameters<typeof saveConnection>[0]["data"]) => saveConnection({ data }),
      onSuccess: invalidate,
    }),
    setCredential: useMutation({
      mutationFn: (data: Parameters<typeof setCredential>[0]["data"]) => setCredential({ data }),
      onSuccess: invalidate,
    }),
    disableConnection: useMutation({
      mutationFn: (data: Parameters<typeof disableConnection>[0]["data"]) => disableConnection({ data }),
      onSuccess: invalidate,
    }),
    testConnection: useMutation({
      mutationFn: (data: Parameters<typeof testConnection>[0]["data"]) => testConnection({ data }),
      onSuccess: invalidate,
    }),
    deriveTerms: useMutation({
      mutationFn: (data: { tenantId: string; awardedProgramIds?: string[] }) => deriveTerms({ data }),
      onSuccess: invalidate,
    }),
    updateTerms: useMutation({
      mutationFn: (data: { id: string; tenantId: string; patch: Record<string, unknown> }) =>
        updateTerms({ data }),
      onSuccess: invalidate,
    }),
    previewCampaign: (data: CreateCampaignInput) => preview({ data }),
    createCampaign: useMutation({
      mutationFn: (data: CreateCampaignInput) => createCampaign({ data }),
      onSuccess: invalidate,
    }),
    rerun: useMutation({
      mutationFn: (data: { tenantId: string; campaignId: string; checkIds?: string[]; failuresOnly?: boolean }) =>
        rerun({ data }),
      onSuccess: (_r, vars) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["rl-campaign", vars.campaignId] });
      },
    }),
    setEntitlement: useMutation({
      mutationFn: (data: Parameters<typeof setEntitlement>[0]["data"]) => setEntitlement({ data }),
      onSuccess: invalidate,
    }),
    getEvidenceUrl: (evidenceId: string) => evidenceUrl({ data: { evidenceId } }),
  };
}

export const RESULT_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  PASS_EXACT: { label: "Carregada corretamente", tone: "ok" },
  PASS_WITH_TOLERANCE: { label: "Dentro da tolerância", tone: "ok" },
  LOADED_WITH_MISMATCH: { label: "Carregada com divergência", tone: "warn" },
  RATE_VALUE_MISMATCH: { label: "Valor divergente", tone: "warn" },
  CURRENCY_MISMATCH: { label: "Moeda divergente", tone: "warn" },
  ROOM_TYPE_MISMATCH: { label: "Tipo de quarto divergente", tone: "warn" },
  RATE_PLAN_MISMATCH: { label: "Plano tarifário divergente", tone: "warn" },
  AMENITY_MISMATCH: { label: "Comodidade divergente", tone: "warn" },
  BREAKFAST_MISMATCH: { label: "Café da manhã divergente", tone: "warn" },
  TAX_MISMATCH: { label: "Impostos divergentes", tone: "warn" },
  CANCELLATION_MISMATCH: { label: "Cancelamento divergente", tone: "warn" },
  LRA_MISMATCH: { label: "Disponibilidade (LRA) divergente", tone: "warn" },
  RATE_NOT_FOUND: { label: "Tarifa não carregada", tone: "bad" },
  HOTEL_NOT_FOUND: { label: "Hotel não encontrado", tone: "bad" },
  MANUAL_REVIEW: { label: "Revisão manual", tone: "info" },
  NEEDS_HUMAN_ACTION: { label: "Ação humana necessária", tone: "info" },
  LOGIN_FAILED: { label: "Falha de acesso ao portal", tone: "bad" },
  PORTAL_ERROR: { label: "Erro no portal", tone: "bad" },
  AUTOMATION_ERROR: { label: "Erro na automação", tone: "bad" },
};
