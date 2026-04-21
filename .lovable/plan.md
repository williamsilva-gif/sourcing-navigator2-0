

## Resposta às suas dúvidas

### 1. Onde colocar o relatório do diagnóstico?

Hoje o módulo `/diagnostico` mostra KPIs e gráficos com dados **mockados** (hard-coded em `CityHeatmap.tsx` e `AdrHistogram.tsx`). Não existe ponto de upload. Precisamos criar um **painel de ingestão de dados** dentro do próprio Diagnóstico, onde você sobe os arquivos brutos do programa atual (Excel/CSV de bookings, extrato do TMC, relatório do GDS).

### 2. De onde a Estratégia extrai os dados?

Hoje `/estrategia` também usa dados estáticos em `strategyData.ts`. O fluxo correto, que vou implementar, é:

```text
[Upload de bookings]  →  /diagnostico
        │  (consolida ADR, RN, spend, leakage por cidade/hotel)
        ▼
[Baseline calculado]  →  fonte única de verdade
        │
        ├──►  /diagnostico  (KPIs, heatmap, histograma)
        ├──►  /estrategia   (tiering, city caps, clusters — sugeridos pelo baseline)
        ├──►  /rfp          (cidades e hotéis pré-selecionados a partir do baseline)
        └──►  /monitoramento (ADR real vs negociado)
```

A Estratégia não inventa números — ela **lê o baseline do Diagnóstico** e propõe tiering/caps/clusters automaticamente, que você ajusta manualmente.

---

## Plano de implementação

### Etapa 1 — Painel de ingestão no Diagnóstico
Novo componente `DataIngestionPanel.tsx` no topo de `/diagnostico` com:
- **Upload zone** (drag-and-drop) aceitando `.xlsx`, `.csv`, `.xls`
- 3 tipos de arquivo esperados:
  1. **Bookings** (booking_id, hotel, cidade, check-in, RN, ADR, canal)
  2. **Hotéis cadastrados** (id, nome, cidade, categoria, tier sugerido)
  3. **Contratos vigentes** (hotel, ADR negociado, cap, validade) — opcional
- Lista de arquivos carregados com status (Processado / Erro / Pendente), data e linhas importadas
- Botão "Recalcular baseline" que dispara o processamento
- Template de download para cada tipo de arquivo (.xlsx vazio com colunas corretas)

### Etapa 2 — Store de baseline compartilhado
Criar `src/lib/baselineStore.ts` (Zustand ou contexto simples) com:
- `bookings[]`, `hotels[]`, `contracts[]` carregados
- Seletores derivados: `kpisByPeriod()`, `cityAggregates()`, `adrDistribution()`, `hotelRanking()`
- Por enquanto **em memória** (state local) — sem persistência ainda, para validar o fluxo. Mensagem visível: "Dados carregados nesta sessão. Persistência em breve."

### Etapa 3 — Conectar Diagnóstico ao store
- `KpiCard`s, `CityHeatmap` e `AdrHistogram` passam a ler do store
- Quando vazio: estado "Carregue um arquivo de bookings para gerar o diagnóstico" com CTA para o upload
- Quando carregado: KPIs e gráficos calculados em tempo real

### Etapa 4 — Conectar Estratégia ao store
- `CITY_STRATEGY` deixa de ser constante: vira `useDerivedCityStrategy()` que pega cidades do baseline, calcula `currentAdr`, `roomNights`, `marketShare` e **sugere** `tier` por faixa de ADR e `capAdr` (ex.: `capAdr = currentAdr * 1.02`)
- Banner no topo: "Sugestões baseadas no baseline de [data]. Ajuste manualmente abaixo."
- Tabela de tiering e city caps continuam editáveis — usuário sobrescreve as sugestões
- Quando store vazio: "Carregue dados no Diagnóstico para gerar a estratégia"

### Etapa 5 — Indicador global de origem dos dados
Pequeno chip na sidebar/header: "Baseline: 12.483 bookings · atualizado há 2 min" ou "Sem dados — usando demo".
Toggle "Usar dados de demonstração" para manter os mocks atuais como fallback enquanto o usuário não sobe nada.

---

## Detalhes técnicos

- **Parsing**: usar `xlsx` (SheetJS) no client para ler `.xlsx`/`.csv` direto no browser — sem backend nesta fase
- **Validação de schema**: cada tipo de arquivo tem um `zodSchema` que valida headers e tipos; erros listados linha a linha no painel
- **Templates**: gerados on-the-fly com `xlsx` e disponibilizados via `<a download>`
- **Performance**: até ~50k linhas em memória sem problema; agregações com `useMemo`
- **Próxima fase (não nesta entrega)**: persistir no Lovable Cloud (tabelas `bookings`, `hotels`, `contracts` com RLS por cliente) e mover o parsing para uma server function — fica como evolução depois que o fluxo manual estiver validado

### Arquivos a criar
- `src/lib/baselineStore.ts`
- `src/lib/baselineSchemas.ts` (schemas Zod)
- `src/lib/xlsxTemplates.ts` (gerador de templates)
- `src/components/diagnostico/DataIngestionPanel.tsx`
- `src/components/diagnostico/EmptyBaselineState.tsx`

### Arquivos a editar
- `src/routes/diagnostico.tsx` — adicionar painel + ligar KPIs ao store
- `src/components/diagnostico/CityHeatmap.tsx` — consumir store
- `src/components/diagnostico/AdrHistogram.tsx` — consumir store
- `src/routes/estrategia.tsx` — banner de sugestão automática
- `src/components/estrategia/strategyData.ts` — exportar funções derivadas (não constantes fixas)
- `src/components/estrategia/TieringMatrix.tsx` e `CityCapsTable.tsx` — consumir derivadas
- `src/components/layout/Header.tsx` — chip de status do baseline

### Dependência nova
- `xlsx` (SheetJS) — leitura/escrita de Excel no browser
- `zustand` (opcional, ~3KB) ou usar Context API — confirmo na implementação

