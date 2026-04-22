

## Análise de viabilidade dos 3 prompts

### Prompt 1 — "Execute Action dispara fluxo correto" → **JÁ IMPLEMENTADO ✅**
Olhando o código atual, isto já está pronto e funcional:
- `actionStore.ts` já mapeia cada `kind` ao módulo correto (`renegotiation` → `negociacao`, `cap_adjustment` → `estrategia`, `cluster_change` → `estrategia`, `mini_rfp` → `rfp`).
- Já cria registro em "Active Actions" (`actions: [action, ...s.actions]`).
- Já vincula KPIs medidos (`adrBefore/After`, `complianceBefore/After`, `savingsExpected/Realized`).
- Já trackeia status (`initiated → in_progress → completed`) com auto-advance.
- `ActionInboxBanner` já notifica nos módulos `/negociacao`, `/estrategia`, `/rfp`.

**Não precisa refazer.** Re-enviar este prompt arrisca duplicar código e quebrar.

### Prompt 2 — Sistema de recomendação baseado em regras → **FALTA IMPLEMENTAR**
Hoje `decisionData.ts` é uma lista hard-coded. Quando o usuário sobe um baseline novo no Diagnóstico, alertas e oportunidades **continuam estáticos** — não refletem os dados reais. É exatamente o gap.

### Prompt 3 — Avaliação contínua + delta → **FALTA IMPLEMENTAR**
Não existe nenhum mecanismo de "snapshot anterior vs atual". Precisa ser criado.

---

## Plano de implementação (sem quebrar nada)

### 1. Motor de regras `src/lib/recommendationEngine.ts` (novo)

Função pura que consome o baseline (`bookings`, `hotels`, `contracts`) e devolve `{ alerts, opportunities }` derivados. Quatro regras:

| Regra | Threshold | Ação sugerida |
|---|---|---|
| ADR > Cap por +8% | por cidade | renegociação + redução de cap |
| Compliance < 75% | por cidade | revisão de portfólio + remover hotéis fracos |
| Leakage > 15% | global / por cidade | expandir preferred + ajustar pricing |
| Top 2 hotéis > 50% volume | por cidade | adicionar fornecedores (mini-RFP) |

Cada regra produz um `CriticalAlert` (com severidade derivada do gap) **e** uma `Opportunity` com 2-3 `RecommendedAction` já tipadas (reutilizando `ActionPayload` existente).

Compliance e cap por cidade vêm do baseline + `capOverrides` do `actionStore` (caps efetivos = base 280 + overrides aplicados). Se não houver baseline, **mantém o mock atual** (fallback gracioso).

### 2. `decisionData.ts` vira fallback

Mantém os mocks atuais como `FALLBACK_ALERTS` e `FALLBACK_OPPORTUNITIES`. Adiciona seletor:
```ts
selectAlerts(bookings, capOverrides) → CriticalAlert[]
selectOpportunities(bookings, capOverrides) → Opportunity[]
```
Que retornam derivados se houver bookings, fallback caso contrário.

### 3. Snapshot store `src/lib/snapshotStore.ts` (novo)

Loop de avaliação contínua simulado:
- Guarda último snapshot (`{ timestamp, kpis, alerts, opportunities }`).
- Função `evaluate()` recalcula via engine, compara com anterior, gera **deltas** (% change) por cidade/métrica.
- Auto-trigger: a cada upload de baseline (subscribe do `baselineStore`) + botão manual "Re-avaliar agora" no header do dashboard.
- Simulação semanal: badge "Próxima reavaliação automática em X dias" (puramente visual, sem cron real — é um app browser-side).

### 4. UI do dashboard (`src/routes/index.tsx` + componentes)

- **Header do dashboard**: novo chip "Última avaliação: há 2 min" + botão "Reavaliar" (chama `evaluate()`).
- **CriticalAlerts**: passa a consumir `selectAlerts()`. Cada alert ganha um sub-rótulo de delta: "↑ +12% vs semana anterior" quando há snapshot anterior.
- **OpportunitiesList**: consome `selectOpportunities()`. Itens ganham badge "NOVA" se apareceram no último delta.
- Indicador visual quando uma oportunidade foi resolvida (já existe ação executada para ela) — opacidade reduzida + tag "Em execução".

### 5. Diagnóstico → trigger automático

Quando `baselineStore.ingest()` roda, chama `snapshotStore.evaluate()` automaticamente. Toast: "Recomendações atualizadas: 3 novos alertas, 2 oportunidades."

---

## Arquivos

**Novos:**
- `src/lib/recommendationEngine.ts` — funções puras de regras
- `src/lib/snapshotStore.ts` — Zustand para snapshots + delta

**Editados (mudanças cirúrgicas, sem refactor):**
- `src/components/dashboard/decisionData.ts` — adiciona seletores; mantém constantes como fallback
- `src/components/dashboard/CriticalAlerts.tsx` — consome seletor + mostra delta
- `src/components/dashboard/OpportunitiesList.tsx` — consome seletor + badge "nova"/"em execução"
- `src/routes/index.tsx` — chip de status + botão reavaliar
- `src/components/diagnostico/DataIngestionPanel.tsx` — trigger pós-upload

**Não tocar:**
- `actionStore.ts`, `RecommendedActionsModal.tsx`, `ActiveActions.tsx`, `ActionInboxBanner.tsx`, rotas dos módulos. Já estão estáveis.

---

## Por que não quebra

1. **Fallback em camadas**: sem baseline → mocks atuais; com baseline → derivados. Ambos retornam o mesmo tipo `Opportunity[]`.
2. **Tipos preservados**: `ActionPayload` e `RecommendedAction` continuam idênticos — modal e store funcionam sem alteração.
3. **Nenhuma rota nova**: tudo dentro do dashboard existente.
4. **Sem dependências novas**: usa Zustand (já instalado).

