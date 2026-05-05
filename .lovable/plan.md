# Navigator Go-Live — Plano de Arquitetura

## TL;DR

Sua lista está 80% no caminho certo. Boa parte do que está descrito **já está implementado** (engine puro, useMemo, action engine com overrides, demo data). O que falta de verdade para ir para o cliente são **3 coisas**:

1. **Closure real do loop de impacto** — ações de `renegotiation`, `mini_rfp` e `cluster_change` ainda não mexem nos derivados. Só `cap_adjustment` fecha o loop hoje.
2. **Camada Admin mínima** — appConfig + clients + roles + módulos, sem overengineering.
3. **Eliminar o último resquício de state derivado** — `decisionData.ts` tem mocks que confundem; mover snapshot para puro também.

O resto do seu prompt (loops infinitos, useMemo, demo data) **já foi feito** em loops anteriores. Vou listar item por item o que existe, o que falta, e o que **não recomendo** fazer.

---

## Status atual vs proposta

| Item da proposta | Status hoje | Ação |
|---|---|---|
| Decision engine puro | ✅ `recommendationEngine.ts` é puro | manter |
| `useMemo` nos derivados | ✅ `useDecisionData` usa | manter |
| Sem `useState` para opportunities | ✅ não há | manter |
| `executeAction()` com side-effects | ✅ existe em `actionStore` | **expandir** (ver §1) |
| `cap_adjustment` muda recálculo | ✅ via `capOverrides` | manter |
| `renegotiation` muda ADR efetivo | ❌ só simula KPIs internos da action | **adicionar** `adrAdjustments` |
| `cluster_change` afeta engine | ❌ guardado em `clusterMoves` mas não lido | **adicionar** `portfolioOverrides` |
| `mini_rfp` afeta engine | ❌ idem | **adicionar** `marketExpansion` |
| Engine não re-sugere ação executada | ❌ pode re-sugerir | **adicionar** dedupe por `opportunityId` |
| Demo data | ✅ `demoData.ts` + botão dev | manter |
| Snapshot/loop visual antes/depois | ✅ `snapshotStore` | manter |
| **AppConfig store** | ❌ não existe | **criar** (§2) |
| **Clients store + dropdown** | ❌ não existe | **criar** (§2) |
| **Roles (admin/manager/viewer)** | ❌ não existe | **criar** (§2) |
| **Module feature flags** | ❌ não existe | **criar** (§2) |
| **Página /admin** | ❌ não existe | **criar** (§3) |

---

## §1 — Fechar o loop de impacto (PRIORIDADE 1)

Hoje só `cap_adjustment` realimenta o engine. Vamos estender `actionStore` com 3 novos overrides e plugá-los em `recommendationEngine.evaluateRules`.

**Novo shape em `actionStore`:**

```ts
adrAdjustments: Record<string, number>      // city -> % redução (negativo)
portfolioOverrides: Record<string, {        // city -> hotéis adicionados
  addedHotels: number;
  cluster: string;
}>
marketExpansion: Record<string, boolean>    // city -> mini-RFP em curso
executedOpportunityIds: Set<string>         // dedupe
```

**Side-effects em `executeAction`:**
- `renegotiation` → grava `adrAdjustments[city] = -targetAdrReduction`
- `cluster_change` → grava `portfolioOverrides[city]`
- `mini_rfp` → grava `marketExpansion[city] = true`
- todas → adicionam `opportunityId` ao set executado

**Engine atualizado** — `evaluateRules(bookings, overrides)`:
- ADR efetivo da cidade = `adr * (1 + adrAdjustments[city]/100)` antes de calcular gap vs cap
- Concentração reduzida quando `portfolioOverrides[city].addedHotels > 0`
- Top-2 share recalculado proporcionalmente quando `marketExpansion[city]` ativo
- Filtra opportunities cujo `id` já está em `executedOpportunityIds`

**Resultado visível:** após executar "Renegociar SP -10%", a opp de SP cai/desaparece do dashboard, savings recalculam, KPI muda. O loop fecha de verdade.

---

## §2 — Camada Admin (PRIORIDADE 2)

**Novos stores (Zustand, sem persistência por enquanto — fica em memória):**

```ts
// src/lib/appConfigStore.ts
{
  user: { id, name, role: 'admin'|'manager'|'viewer' },
  enabledModules: { dashboard, diagnostico, estrategia, rfp, negociacao, selecao, monitoramento, analise, admin },
  thresholds: { adrGapPct: 8, compliancePct: 75, leakagePct: 15, concentrationPct: 50 },
  defaultCap: 280,
}

// src/lib/clientsStore.ts
{
  clients: [{ id, name, type: 'TMC'|'Corporate' }],
  selectedClientId: string,
  selectClient(id),
  addClient(...),
}
```

**Hooks helpers:**
- `useCanExecute()` → `role !== 'viewer'`
- `useModuleEnabled(name)` → bool
- `useThresholds()` → consumido pelo engine

**Integração mínima na UI existente:**
- `Sidebar.tsx` filtra itens por `enabledModules`
- Botões "Take action" / "Execute" desabilitados quando `role === 'viewer'`
- Header ganha dropdown de cliente (à esquerda do user)
- `recommendationEngine` lê thresholds do store em vez de hardcode

---

## §3 — Página /admin

Nova rota `src/routes/admin.tsx` com tabs:

1. **Clients** — tabela + criar/editar + selecionar ativo
2. **Modules** — switches on/off por módulo
3. **Users & Roles** — lista mock (1 usuário) + dropdown de role
4. **Business Rules** — inputs para thresholds (ADR gap %, compliance %, leakage %, concentração %, default cap)

Tudo escrito no `appConfigStore` / `clientsStore`. Visível só se `role === 'admin'` e `enabledModules.admin`.

---

## §4 — Limpeza e consistência

- `decisionData.ts` — manter os tipos e `fmtUsd`, **remover** `FALLBACK_ALERTS` / `FALLBACK_OPPORTUNITIES` do path principal. Quando não há baseline, retornar lista vazia + CTA "Carregar Demo Data" (já existe). Simplifica e elimina ambiguidade entre "demo" e "real".
- Garantir que `snapshotStore.evaluate()` use o engine atualizado (já usa, basta passar os novos overrides como argumento — ou ler do store dentro de `buildSnapshot`).

---

## O que NÃO vou fazer (e por quê)

- ❌ **Reescrever tudo em `computeDecisionState({...})` único.** Já temos `evaluateRules` puro + `useDecisionData` com `useMemo`. Trocar o nome não traz valor; só causa diff gigante e risco de regressão.
- ❌ **Persistência multi-cliente real (DB).** Sua lista pede "estrutura mínima". Zustand em memória atende para go-live de demo. Quando precisar persistir entre sessões, ativamos Lovable Cloud.
- ❌ **Auth real.** `appConfigStore.user` é mock. Ativar Lovable Cloud Auth é outro passo, fora desta entrega.
- ❌ **Re-mexer em loops infinitos / useEffect.** Já estabilizado nos loops anteriores. Não há mais loops conhecidos.
- ❌ **Refatorar `decisionData` para "nunca persistir nada".** O que hoje existe ali já é derivado via `useMemo`. Nada está em `useState`.

---

## Detalhes técnicos (para o Dev)

**Arquivos novos:**
- `src/lib/appConfigStore.ts`
- `src/lib/clientsStore.ts`
- `src/routes/admin.tsx`
- `src/components/admin/ClientsPanel.tsx`
- `src/components/admin/ModulesPanel.tsx`
- `src/components/admin/RolesPanel.tsx`
- `src/components/admin/BusinessRulesPanel.tsx`

**Arquivos editados:**
- `src/lib/actionStore.ts` — adicionar `adrAdjustments`, `portfolioOverrides`, `marketExpansion`, `executedOpportunityIds`; popular em `executeAction`
- `src/lib/recommendationEngine.ts` — assinatura passa a receber `overrides` completo (não só `capOverrides`); aplica ajustes antes de avaliar regras; filtra dedupe; lê thresholds do `appConfigStore`
- `src/lib/snapshotStore.ts` — `buildSnapshot` lê novos overrides
- `src/components/dashboard/decisionData.ts` — remover FALLBACK do fluxo principal; manter export para back-compat se algum lugar ainda importa
- `src/components/layout/Sidebar.tsx` — filtrar por `enabledModules`
- `src/components/layout/Header.tsx` — dropdown de cliente
- `src/components/dashboard/OpportunitiesList.tsx` e modal — desabilitar botão se `viewer`
- `src/router.tsx` / route tree — registrar `/admin` (TanStack auto-gen)

**Ordem de implementação (incremental, sem quebrar):**
1. Estender `actionStore` com novos overrides (sem mudar engine ainda) → compila, nada quebra
2. Estender `recommendationEngine` para consumir overrides → testes manuais com demo data
3. Criar `appConfigStore` + `clientsStore` (vazio, defaults sensatos)
4. Sidebar/Header consomem flags + cliente
5. Criar `/admin` com 4 tabs
6. Limpar `decisionData.ts` (FALLBACK fora do path principal)
7. QA: executar cada tipo de ação, verificar que oportunidade some/recalcula, snapshot mostra delta

---

## Risco / por que não quebra

- Novos campos no `actionStore` são opcionais e default `{}`/`new Set()` — nenhum consumidor existente quebra.
- `recommendationEngine` aceita um objeto `overrides` retrocompatível: se chamado com `capOverrides` puro, usa só esse (passo de migração curto).
- `appConfigStore` com defaults "tudo habilitado, role=admin" → app continua funcionando idêntico se ninguém mexer no admin.
- Página `/admin` é nova; não toca rotas existentes.
- Sem dependências novas. Sem mudança de schema. Sem Lovable Cloud nesta fase.