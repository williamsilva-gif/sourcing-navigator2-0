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

export const CITY_STRATEGY: CityStrategy[] = [
  { city: "São Paulo", state: "SP", tier: "Upscale", roomNights: 18420, currentAdr: 317, capAdr: 320, hotels: 42, priority: "Alta", marketShare: 34.4 },
  { city: "Rio de Janeiro", state: "RJ", tier: "Upscale", roomNights: 9870, currentAdr: 325, capAdr: 310, hotels: 28, priority: "Alta", marketShare: 18.4 },
  { city: "Brasília", state: "DF", tier: "Upscale", roomNights: 6240, currentAdr: 317, capAdr: 330, hotels: 19, priority: "Alta", marketShare: 11.6 },
  { city: "Belo Horizonte", state: "MG", tier: "Midscale", roomNights: 4180, currentAdr: 258, capAdr: 270, hotels: 14, priority: "Média", marketShare: 7.8 },
  { city: "Curitiba", state: "PR", tier: "Midscale", roomNights: 3520, currentAdr: 241, capAdr: 250, hotels: 12, priority: "Média", marketShare: 6.6 },
  { city: "Porto Alegre", state: "RS", tier: "Midscale", roomNights: 3110, currentAdr: 250, capAdr: 260, hotels: 11, priority: "Média", marketShare: 5.8 },
  { city: "Recife", state: "PE", tier: "Midscale", roomNights: 2680, currentAdr: 231, capAdr: 240, hotels: 9, priority: "Média", marketShare: 5.0 },
  { city: "Salvador", state: "BA", tier: "Midscale", roomNights: 2240, currentAdr: 241, capAdr: 245, hotels: 8, priority: "Baixa", marketShare: 4.2 },
  { city: "Fortaleza", state: "CE", tier: "Economy", roomNights: 1980, currentAdr: 212, capAdr: 230, hotels: 7, priority: "Baixa", marketShare: 3.7 },
  { city: "Manaus", state: "AM", tier: "Upscale", roomNights: 1420, currentAdr: 267, capAdr: 250, hotels: 6, priority: "Baixa", marketShare: 2.5 },
];

export const CLUSTERS: ClusterDefinition[] = [
  {
    type: "Strategic",
    hotels: 18,
    rnShare: 52,
    spendShare: 58,
    rule: "Top hotéis em cidades Alta prioridade · contrato anual com fixed last room availability",
    color: "primary",
    rfpFrequency: "Anual",
    negotiationDepth: "Profunda · 3+ rodadas",
  },
  {
    type: "Preferred",
    hotels: 34,
    rnShare: 28,
    spendShare: 25,
    rule: "Cobertura secundária · ADR negociado dentro do cap · sem garantia de inventário",
    color: "info",
    rfpFrequency: "Anual",
    negotiationDepth: "Média · 2 rodadas",
  },
  {
    type: "Tactical",
    hotels: 67,
    rnShare: 16,
    spendShare: 13,
    rule: "Long-tail · uso pontual · monitorar leakage · sem contrato fixo",
    color: "warning",
    rfpFrequency: "Spot",
    negotiationDepth: "Leve · 1 rodada",
  },
  {
    type: "Drop",
    hotels: 37,
    rnShare: 4,
    spendShare: 4,
    rule: "Compliance < 60% ou ADR > cap +15% · sair do programa no próximo ciclo",
    color: "destructive",
    rfpFrequency: "Não convidar",
    negotiationDepth: "—",
  },
];

export const BUSINESS_RULES: BusinessRule[] = [
  {
    id: "R-01",
    category: "Cap",
    trigger: "ADR proposto > city cap em qualquer cidade",
    action: "Reprovação automática · hotel volta para rodada de contraproposta",
    active: true,
  },
  {
    id: "R-02",
    category: "Cap",
    trigger: "ADR atual > cap em > 10% por 2 trimestres consecutivos",
    action: "Aumentar cap em até 5% mediante aprovação do gestor",
    active: true,
  },
  {
    id: "R-03",
    category: "Tier",
    trigger: "Cidade com market share > 15% e ADR médio > $300",
    action: "Classificar como tier Upscale e prioridade Alta",
    active: true,
  },
  {
    id: "R-04",
    category: "Cluster",
    trigger: "Hotel com compliance < 60% ou negociação fora do cap",
    action: "Mover para cluster Drop · não convidar no próximo RFP",
    active: true,
  },
  {
    id: "R-05",
    category: "Cluster",
    trigger: "Top 3 hotéis em cidade tier Upscale com volume > 1.000 RN/ano",
    action: "Promover para Strategic · contratar last room availability",
    active: true,
  },
  {
    id: "R-06",
    category: "Compliance",
    trigger: "Booking fora do programa em cidade com hotel preferred disponível",
    action: "Notificar travel manager · contabilizar leakage no dashboard",
    active: true,
  },
  {
    id: "R-07",
    category: "Compliance",
    trigger: "Hotel preferred com taxa de cancelamento > 12%",
    action: "Renegociar termos de cancelamento na próxima rodada",
    active: false,
  },
];

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