// Lightweight React Query hooks for the new per-tenant demo tables.
// All reads are filtered by client_tenant_id (RLS also enforces visibility).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function makeKey(table: string, tenantId: string | null | undefined) {
  return [table, tenantId ?? "none"] as const;
}

async function fetchByTenant<T>(table: string, tenantId: string): Promise<T[]> {
  // Cast through unknown — supabase typegen hasn't picked up the new tables yet.
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: T[] | null; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await client.from(table).select("*").eq("client_tenant_id", tenantId);
  if (error) throw new Error(error.message);
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

// Adapter for legacy components expecting the `AwardedHotel` shape.
export interface AwardedHotelView {
  id: string; hotel: string; brand: string; city: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  finalAdr: number; cap: number; startingAdr: number; roomNights: number;
  qualityScore: number; compliance: number; amenities: string[];
  cancellationHours: number; contractStart: string; contractEnd: string;
  status: "primary" | "backup";
}
export function useAwardedHotels(tenantId: string | null | undefined) {
  const q = useAwardedProgram(tenantId);
  const rows: AwardedHotelView[] = (q.data ?? []).map((r) => ({
    id: r.id,
    hotel: r.hotel_name,
    brand: r.brand ?? "",
    city: r.city,
    tier: (r.tier as AwardedHotelView["tier"]) ?? "Midscale",
    finalAdr: Number(r.final_adr) || 0,
    cap: Number(r.cap) || 0,
    startingAdr: Number(r.starting_adr) || 0,
    roomNights: Number(r.room_nights) || 0,
    qualityScore: Number(r.quality_score) || 0,
    compliance: Number(r.compliance_pct) || 0,
    amenities: r.amenities ?? [],
    cancellationHours: r.cancellation_hours ?? 24,
    contractStart: r.contract_start ?? "",
    contractEnd: r.contract_end ?? "",
    status: r.status,
  }));
  return { ...q, rows };
}
export function useDemandTargets(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: makeKey("demand_targets", tenantId),
    queryFn: () => fetchByTenant<DemandTargetRow>("demand_targets", tenantId!),
    enabled: !!tenantId,
  });
}

// Adapter that maps DB analysis rows + awarded program to the legacy `RfpRow`
// shape consumed by RfpComparisonTable / RfpCompareModal.
export interface RfpRowView {
  id: string;
  hotel: string;
  brand: string;
  city: string;
  tier: "Luxury" | "Upscale" | "Midscale" | "Economy";
  adr: number;
  cap: number;
  variation: number;
  roomNights: number;
  spend: number;
  breakfast: boolean;
  wifi: boolean;
  cancellation: number;
  lra: boolean;
  scoreCommercial: number;
  scoreCompliance: number;
  scoreLocation: number;
  scoreTotal: number;
  status: "approved" | "negotiation" | "rejected" | "pending";
  responseDate: string;
  contact: string;
  notes: string;
}
export function useRfpComparisonRows(tenantId: string | null | undefined) {
  const analysis = useRfpAnalysis(tenantId);
  const awarded = useAwardedProgram(tenantId);
  const awardedByHotel = new Map<string, AwardedRow>();
  (awarded.data ?? []).forEach((a) => awardedByHotel.set(a.hotel_name, a));

  const rows: RfpRowView[] = (analysis.data ?? []).map((a) => {
    const aw = awardedByHotel.get(a.hotel_name);
    const adr = Number(a.proposed_adr) || 0;
    const cap = aw ? Number(aw.cap) : Math.round(adr * 1.05);
    const variation = cap > 0 ? ((adr - cap) / cap) * 100 : 0;
    const rn = aw ? Number(aw.room_nights) : 500;
    const amenities = a.amenities ?? aw?.amenities ?? [];
    const scoreCommercial = Math.max(0, Math.min(100, Math.round(50 + a.savings_pct * 4)));
    const scoreCompliance = Math.round(a.compliance_pct);
    const scoreLocation = Math.round(a.quality_score);
    const scoreTotal = Math.round(
      scoreCommercial * 0.5 + scoreCompliance * 0.3 + scoreLocation * 0.2,
    );
    const status: RfpRowView["status"] =
      a.recommendation === "approve" ? "approved" :
      a.recommendation === "negotiate" ? "negotiation" :
      a.recommendation === "reject" ? "rejected" : "pending";
    return {
      id: a.id,
      hotel: a.hotel_name,
      brand: aw?.brand ?? a.hotel_name.split(/[\s-]+/)[0] ?? "",
      city: a.city,
      tier: (aw?.tier as RfpRowView["tier"]) ?? "Midscale",
      adr,
      cap,
      variation,
      roomNights: rn,
      spend: adr * rn,
      breakfast: amenities.includes("breakfast"),
      wifi: amenities.includes("wifi"),
      cancellation: aw?.cancellation_hours ?? 24,
      lra: amenities.includes("lra"),
      scoreCommercial,
      scoreCompliance,
      scoreLocation,
      scoreTotal,
      status,
      responseDate: "",
      contact: "",
      notes: a.notes ?? "",
    };
  });
  return {
    rows,
    isLoading: analysis.isLoading || awarded.isLoading,
    error: analysis.error || awarded.error,
  };
}
