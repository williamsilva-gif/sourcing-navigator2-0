import type { ModuleKey } from "./appConfigStore";

export interface FeatureDef {
  key: string;
  label: string;
  description?: string;
  /** Default enabled state for new clients */
  default?: boolean;
}

/**
 * Catálogo de funcionalidades por módulo. Cada feature pode ser ligada/desligada
 * por cliente em Admin → Funcionalidades. UI usa `useFeatureEnabled(key)` /
 * `<Feature flag="...">` para esconder controles.
 *
 * Convenção de chaves: `<modulo>.<acao>` em camelCase.
 */
export const FEATURE_CATALOG: Record<ModuleKey, FeatureDef[]> = {
  dashboard: [
    { key: "dashboard.actions", label: "Ações recomendadas", description: "Painel de ações sugeridas pela IA" },
    { key: "dashboard.exportPdf", label: "Exportar PDF" },
  ],
  diagnostico: [
    { key: "diagnostico.uploadBaseline", label: "Upload de baseline", description: "Permite enviar planilhas de bookings/contratos" },
    { key: "diagnostico.heatmap", label: "Heatmap de cidades" },
  ],
  estrategia: [
    { key: "estrategia.editCaps", label: "Editar caps por cidade" },
    { key: "estrategia.editTiering", label: "Editar matriz de tiering" },
    { key: "estrategia.editClusters", label: "Editar clusters" },
  ],
  rfp: [
    { key: "rfp.create", label: "Criar novo RFP", description: "Botão 'Novo RFP'" },
    { key: "rfp.viewDetails", label: "Ver detalhes do RFP" },
    { key: "rfp.invite", label: "Convidar hotéis para RFP" },
    { key: "rfp.export", label: "Exportar respostas" },
  ],
  analise: [
    { key: "analise.compare", label: "Comparar respostas (modal)" },
    { key: "analise.export", label: "Exportar comparativo" },
  ],
  negociacao: [
    { key: "negociacao.createLot", label: "Criar lote de negociação" },
    { key: "negociacao.reverseAuction", label: "Leilão reverso" },
    { key: "negociacao.comments", label: "Comentários internos" },
  ],
  selecao: [
    { key: "selecao.award", label: "Adjudicar / aprovar hotel" },
    { key: "selecao.export", label: "Exportar programa" },
  ],
  implementacao: [
    { key: "implementacao.markLoaded", label: "Marcar tarifa como carregada" },
  ],
  monitoramento: [
    { key: "monitoramento.alerts", label: "Alertas em tempo real" },
    { key: "monitoramento.watchlist", label: "Watchlist" },
  ],
  monetizacao: [
    { key: "monetizacao.billing", label: "Faturamento e cobrança" },
  ],
  admin: [
    { key: "admin.manageUsers", label: "Gerenciar usuários do cliente" },
    { key: "admin.editRules", label: "Editar regras de negócio" },
  ],
};

/** Lista plana de todas as feature keys */
export const ALL_FEATURE_KEYS: string[] = Object.values(FEATURE_CATALOG)
  .flat()
  .map((f) => f.key);

/** Default record: tudo habilitado, exceto features com default: false */
export function defaultFeatures(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const list of Object.values(FEATURE_CATALOG)) {
    for (const f of list) out[f.key] = f.default ?? true;
  }
  return out;
}

/** Lookup label por key */
export function featureLabel(key: string): string {
  for (const list of Object.values(FEATURE_CATALOG)) {
    const f = list.find((x) => x.key === key);
    if (f) return f.label;
  }
  return key;
}
