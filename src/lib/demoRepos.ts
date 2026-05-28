// Lightweight React Query hooks for the new per-tenant demo tables.
// All reads are filtered by client_tenant_id (RLS also enforces visibility).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function makeKey(table: string, tenantId: string | null | undefined) {
  return [table, tenantId ?? "none"] as const;
}

async function fetchByTenant<T>(table: string, tenantId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").eq("client_tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as T[];
}

// Strategy
export interface StrategyTierRow {
  id: string; tier: string; brands: string[]; qs_min: number; qs_max: number;
  share_pct: number; notes: string | null; position: number;
}
export interface StrategyCapRow {
  id: string; city: string; baseline_adr: number; suggested_cap: number;
  approved_cap: number | null; rationale: string | null;
}
export interface StrategyClusterRow {
  id: string; name: string; hotels: string[]; cities: string[]; rationale: string | null; share_pct: number;
}
export function useStrategyTiers(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("strategy_tiers", tenantId),
    queryFn: () => fetchByTenant<StrategyTierRow>("strategy_tiers", tenantId!),
    enabled: !!tenantId,
  });
}
export function useStrategyCaps(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("strategy_caps", tenantId),
    queryFn: () => fetchByTenant<StrategyCapRow>("strategy_caps", tenantId!),
    enabled: !!tenantId,
  });
}
export function useStrategyClusters(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("strategy_clusters", tenantId),
    queryFn: () => fetchByTenant<StrategyClusterRow>("strategy_clusters", tenantId!),
    enabled: !!tenantId,
  });
}

// Analysis
export interface RfpAnalysisRow {
  id: string; rfp_id: string | null; hotel_name: string; city: string;
  current_adr: number; proposed_adr: number; savings_pct: number;
  quality_score: number; compliance_pct: number; amenities: string[];
  recommendation: string; notes: string | null;
}
export function useRfpAnalysis(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("rfp_analysis_rows", tenantId),
    queryFn: () => fetchByTenant<RfpAnalysisRow>("rfp_analysis_rows", tenantId!),
    enabled: !!tenantId,
  });
}

// Negotiation
export interface NegLot {
  id: string; name: string; city: string; status: string;
  hotels_count: number; target_savings_pct: number; current_savings_pct: number;
  owner: string | null; deadline: string | null; notes: string | null;
}
export interface NegThread {
  id: string; lot_id: string; hotel_name: string; city: string;
  starting_adr: number; current_offer: number; target_adr: number;
  status: string; last_message_at: string | null; last_message_from: string | null;
  owner: string | null; deadline: string | null;
}
export function useNegotiationLots(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("negotiation_lots", tenantId),
    queryFn: () => fetchByTenant<NegLot>("negotiation_lots", tenantId!),
    enabled: !!tenantId,
  });
}
export function useNegotiationThreads(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("negotiation_threads", tenantId),
    queryFn: () => fetchByTenant<NegThread>("negotiation_threads", tenantId!),
    enabled: !!tenantId,
  });
}

// Program (Diretório de Hotéis)
export interface AwardedRow {
  id: string; hotel_name: string; brand: string | null; city: string; tier: string;
  final_adr: number; cap: number; starting_adr: number; room_nights: number;
  quality_score: number; compliance_pct: number; amenities: string[];
  cancellation_hours: number; contract_start: string | null; contract_end: string | null;
  status: "primary" | "backup";
}
export interface DemandTargetRow {
  id: string; city: string; target_nights: number;
}
export function useAwardedProgram(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("awarded_program", tenantId),
    queryFn: () => fetchByTenant<AwardedRow>("awarded_program", tenantId!),
    enabled: !!tenantId,
  });
}
export function useDemandTargets(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("demand_targets", tenantId),
    queryFn: () => fetchByTenant<DemandTargetRow>("demand_targets", tenantId!),
    enabled: !!tenantId,
  });
}
