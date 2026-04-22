// Centralized mock data for the Continuous Decision Center.
// Designed to be replaced by selectors from baselineStore in the next iteration.

export type Severity = "high" | "medium" | "low";
export type Priority = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";
export type ActionStatus = "in_progress" | "completed";

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
  module: "negociacao" | "estrategia" | "rfp" | "selecao";
}

export interface Opportunity {
  id: string;
  scope: string; // city or hotel
  region: string;
  savings: number; // USD
  reason: string;
  priority: Priority;
  actions: RecommendedAction[];
}

export interface ActiveAction {
  id: string;
  type: "Renegociação" | "Mini-RFP" | "Ajuste de cap";
  city: string;
  status: ActionStatus;
  expectedSavings: number;
  startedAt: string;
  module: "negociacao" | "rfp" | "estrategia";
}

export interface ImpactPoint {
  month: string;
  expected: number;
  actual: number;
}

export const CRITICAL_ALERTS: CriticalAlert[] = [
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

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-1",
    scope: "São Paulo, BR",
    region: "LATAM",
    savings: 142000,
    reason: "ADR efetivo 12% acima do cap em 38% das reservas",
    priority: "high",
    actions: [
      {
        id: "act-1-1",
        label: "Lançar renegociação com 5 hotéis Tier 2",
        impact: 86000,
        effort: "medium",
        module: "negociacao",
      },
      {
        id: "act-1-2",
        label: "Reduzir city cap de US$ 248 para US$ 220",
        impact: 42000,
        effort: "low",
        module: "estrategia",
      },
      {
        id: "act-1-3",
        label: "Adicionar 3 hotéis ao RFP para aumentar competição",
        impact: 28000,
        effort: "high",
        module: "rfp",
      },
    ],
  },
  {
    id: "opp-2",
    scope: "Mexico City, MX",
    region: "LATAM",
    savings: 96000,
    reason: "Cap desatualizado vs mercado — 3 hotéis Tier 1 fora do programa",
    priority: "high",
    actions: [
      {
        id: "act-2-1",
        label: "Atualizar cap de US$ 175 para US$ 195",
        impact: 38000,
        effort: "low",
        module: "estrategia",
      },
      {
        id: "act-2-2",
        label: "Mini-RFP para 4 hotéis Tier 1 ainda não contratados",
        impact: 58000,
        effort: "medium",
        module: "rfp",
      },
    ],
  },
  {
    id: "opp-3",
    scope: "Bogotá, CO",
    region: "LATAM",
    savings: 78000,
    reason: "Concentração de 71% em 2 hotéis sem alternativa de tarifa",
    priority: "medium",
    actions: [
      {
        id: "act-3-1",
        label: "Adicionar 4 hotéis Midscale ao programa",
        impact: 52000,
        effort: "high",
        module: "rfp",
      },
      {
        id: "act-3-2",
        label: "Renegociar volume com hotel principal (40% do spend)",
        impact: 26000,
        effort: "medium",
        module: "negociacao",
      },
    ],
  },
  {
    id: "opp-4",
    scope: "Buenos Aires, AR",
    region: "LATAM",
    savings: 64000,
    reason: "Variação de ADR entre hotéis do mesmo tier acima de 18%",
    priority: "medium",
    actions: [
      {
        id: "act-4-1",
        label: "Alinhar caps por tier — Upscale para US$ 178",
        impact: 38000,
        effort: "low",
        module: "estrategia",
      },
      {
        id: "act-4-2",
        label: "Renegociar com 2 hotéis acima da média do tier",
        impact: 26000,
        effort: "medium",
        module: "negociacao",
      },
    ],
  },
  {
    id: "opp-5",
    scope: "Lima, PE",
    region: "LATAM",
    savings: 32000,
    reason: "12% das reservas em hotéis fora do programa (leakage)",
    priority: "low",
    actions: [
      {
        id: "act-5-1",
        label: "Comunicação dirigida + lembrete de booking tool",
        impact: 18000,
        effort: "low",
        module: "estrategia",
      },
      {
        id: "act-5-2",
        label: "Adicionar 2 hotéis preferred no centro",
        impact: 14000,
        effort: "medium",
        module: "rfp",
      },
    ],
  },
];

export const ACTIVE_ACTIONS: ActiveAction[] = [
  {
    id: "aa-1",
    type: "Renegociação",
    city: "São Paulo, BR",
    status: "in_progress",
    expectedSavings: 86000,
    startedAt: "há 6 dias",
    module: "negociacao",
  },
  {
    id: "aa-2",
    type: "Mini-RFP",
    city: "Mexico City, MX",
    status: "in_progress",
    expectedSavings: 58000,
    startedAt: "há 12 dias",
    module: "rfp",
  },
  {
    id: "aa-3",
    type: "Ajuste de cap",
    city: "Buenos Aires, AR",
    status: "completed",
    expectedSavings: 38000,
    startedAt: "concluído há 8 dias",
    module: "estrategia",
  },
  {
    id: "aa-4",
    type: "Renegociação",
    city: "Bogotá, CO",
    status: "completed",
    expectedSavings: 26000,
    startedAt: "concluído há 21 dias",
    module: "negociacao",
  },
  {
    id: "aa-5",
    type: "Mini-RFP",
    city: "Santiago, CL",
    status: "in_progress",
    expectedSavings: 44000,
    startedAt: "há 3 dias",
    module: "rfp",
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
