export type Tier = "Luxury" | "Upscale" | "Midscale" | "Economy";
export type ClusterType = "Strategic" | "Preferred" | "Tactical" | "Drop";

export interface CityStrategy {
  city: string;
  state: string;
  tier: Tier;
  roomNights: number;
  currentAdr: number;
  capAdr: number;
  hotels: number;
  priority: "Alta" | "Média" | "Baixa";
  marketShare: number; // % of total volume
}

export interface ClusterDefinition {
  type: ClusterType;
  hotels: number;
  rnShare: number;
  spendShare: number;
  rule: string;
  color: string;
  rfpFrequency: string;
  negotiationDepth: string;
}

export interface BusinessRule {
  id: string;
  category: "Cap" | "Tier" | "Cluster" | "Compliance";
  trigger: string;
  action: string;
  active: boolean;
}

export const CITY_STRATEGY: CityStrategy[] = [];

export const CLUSTERS: ClusterDefinition[] = [];

export const BUSINESS_RULES: BusinessRule[] = [];

export const TIER_META: Record<Tier, { label: string; bg: string; fg: string; rangeAdr: string }> = {
  Luxury: { label: "Luxury", bg: "bg-violet-100", fg: "text-violet-700", rangeAdr: ">$400" },
  Upscale: { label: "Upscale", bg: "bg-primary-soft", fg: "text-primary", rangeAdr: "$280–$400" },
  Midscale: { label: "Midscale", bg: "bg-emerald-100", fg: "text-emerald-700", rangeAdr: "$180–$280" },
  Economy: { label: "Economy", bg: "bg-amber-100", fg: "text-amber-700", rangeAdr: "<$180" },
};

export const PRIORITY_META: Record<CityStrategy["priority"], { bg: string; fg: string }> = {
  Alta: { bg: "bg-rose-100", fg: "text-rose-700" },
  Média: { bg: "bg-amber-100", fg: "text-amber-700" },
  Baixa: { bg: "bg-slate-100", fg: "text-slate-600" },
};