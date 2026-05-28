# Decision Center → Sistema Operacional (Fase 1: Arquitetura)

## Princípios

- **Não quebra nada**: `client_actions` (legado) continua funcionando como está. As novas entidades vivem em tabelas próprias, paralelas. O `actionStore` legado é mantido até a migração futura para o novo modelo.
- **Persistência primeiro**: hoje alertas são derivados em memória a cada render. Vamos materializar alertas para histórico, follow-up e tracking real.
- **Backend-ready**: tudo via Lovable Cloud (Supabase). Server fns com `requireSupabaseAuth`, RLS por tenant, Storage para anexos.
- **Sem UI nesta fase**: nenhuma tela nova, nenhum botão. Só schema, entidades, stores, hooks, server fns.

---

## Modelo de dados (novas tabelas, schema `public`)

### 1. `decision_alerts`
Alertas materializados (snapshot do que o `recommendationEngine` produz + estado operacional).

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | RLS via `can_see_tenant` |
| `type` | text | `ADR_VARIANCE` \| `SMART_LEAKAGE` \| `RATE_LOADING` \| `HOTEL_UNDERPERFORMANCE` \| `HOTEL_DEPENDENCY` \| `SAVINGS_MISSED` |
| `severity` | text | `high` \| `medium` \| `low` |
| `title` | text | |
| `description` | text | |
| `impacted_city` | text | nullable |
| `impacted_hotel` | text | nullable |
| `financial_impact` | numeric | USD esperado |
| `status` | text | `open` \| `in_progress` \| `dismissed` \| `completed` |
| `dismissed_at` / `completed_at` | timestamptz | |
| `signature` | text | hash determinístico (type + city/hotel + período) — para dedupe e merge entre reavaliações |
| `metadata` | jsonb | thresholds violados, métricas brutas |
| `created_at` / `updated_at` | timestamptz | |

Índices: `(client_tenant_id, status)`, `(client_tenant_id, signature)` UNIQUE para upsert idempotente na reavaliação.

### 2. `decision_actions`
Ação operacional ligada a um alerta. Substitui o conceito atual do `client_actions` para o novo fluxo (legado segue intocado).

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | RLS |
| `alert_id` | uuid | FK lógica para `decision_alerts` (sem FK física por simetria com o resto do schema) |
| `type` | text | `SEND_ALERT` \| `FOLLOW_UP` \| `IGNORE` \| `OPEN_MINI_RFP` \| `ADD_TO_PIPELINE` |
| `status` | text | `PENDING` \| `SENT` \| `WAITING_RESPONSE` \| `RESPONDED` \| `COMPLETED` \| `IGNORED` |
| `assigned_to` | uuid | profiles.id, nullable |
| `email_recipients` | text[] | nullable |
| `payload` | jsonb | parâmetros (cidade, alvo, valores, copy de email, etc.) |
| `completed_at` | timestamptz | nullable |
| `created_by` / `created_at` / `updated_at` | | |

Índices: `(client_tenant_id, status)`, `(alert_id)`.

### 3. `decision_watchlist`
Visão operacional persistente. Todo `decision_action` criado entra automaticamente na watchlist (via trigger), e a watchlist guarda o estado de acompanhamento independente do status interno da ação.

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | RLS |
| `action_id` | uuid | UNIQUE — 1:1 com `decision_actions` |
| `pinned` | bool | padrão `false` |
| `due_at` | timestamptz | próximo follow-up |
| `last_activity_at` | timestamptz | atualizado por trigger em follow-ups/comentários |
| `summary` | text | rótulo curto cacheado |
| `created_at` / `updated_at` | | |

Trigger `AFTER INSERT ON decision_actions` cria a linha em `decision_watchlist`.

### 4. `decision_followups`
Eventos de follow-up agendados ou executados sobre uma ação.

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | |
| `action_id` | uuid | |
| `kind` | text | `email` \| `call` \| `meeting` \| `note` |
| `scheduled_at` | timestamptz | |
| `executed_at` | timestamptz | nullable |
| `outcome` | text | `pending` \| `done` \| `no_response` \| `cancelled` |
| `notes` | text | |
| `created_by` / `created_at` / `updated_at` | | |

### 5. `decision_comments`
Thread livre por ação (e/ou por alerta).

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | |
| `action_id` | uuid | nullable |
| `alert_id` | uuid | nullable (pelo menos um dos dois deve ser não-nulo — CHECK constraint) |
| `body` | text | |
| `author_id` | uuid | |
| `created_at` | timestamptz | |

### 6. `decision_attachments`
Metadata de arquivos. Os bytes vão para o bucket existente `baseline-files` em pasta dedicada `decision/{tenant_id}/{action_id}/{file_id}.ext`.

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `client_tenant_id` | uuid | |
| `action_id` | uuid | |
| `storage_path` | text | |
| `filename` | text | |
| `mime_type` | text | |
| `size_bytes` | int | |
| `uploaded_by` / `created_at` | | |

**RLS em todas as 6 tabelas**: `can_see_tenant(auth.uid(), client_tenant_id)` para SELECT/INSERT/UPDATE; DELETE só TA master (operação reversível via `status='dismissed'`). GRANTs para `authenticated` + `service_role`.

---

## Server functions (`src/lib/decision.functions.ts`)

Todas com `.middleware([requireSupabaseAuth])` + Zod validators.

- `upsertAlertsFn({ clientTenantId, alerts[] })` — chamado pelo "Reavaliar". Faz upsert por `signature`: mantém status manual (`dismissed`, `in_progress`, `completed`) e atualiza só campos derivados (severity, financial_impact, metadata).
- `listAlertsFn({ clientTenantId, status? })`
- `dismissAlertFn({ alertId })` / `reopenAlertFn({ alertId })`
- `createActionFn({ alertId, type, payload, assignedTo?, emailRecipients? })` — cria ação + (via trigger) linha de watchlist.
- `updateActionStatusFn({ actionId, status })` — transições validadas no handler.
- `listActionsFn({ clientTenantId, status? })`
- `listWatchlistFn({ clientTenantId, pinnedOnly?, dueBefore? })`
- `pinWatchlistItemFn({ itemId, pinned })`
- `addCommentFn({ actionId? alertId?, body })`
- `addFollowUpFn({ actionId, kind, scheduledAt, notes? })` + `completeFollowUpFn({ followUpId, outcome, notes? })`
- `createAttachmentUploadUrlFn({ actionId, filename, mimeType })` → assina URL no bucket `baseline-files` em `decision/{tenant}/{action}/...` (reaproveita o padrão da Fase 1)
- `recordAttachmentFn({ actionId, storagePath, filename, mimeType, sizeBytes })`

Rate limit (Fase 4 já existe): aplicar `enforceRateLimit` em `createActionFn` (30/min/user) e `addCommentFn` (60/min/user).

---

## Stores (Zustand) e hooks

Novo arquivo `src/lib/decisionStore.ts`:

```ts
interface DecisionState {
  alerts: Alert[];
  actions: Action[];
  watchlist: WatchlistItem[];
  hydratedForTenant: string | null;

  hydrate(tenantId): Promise<void>;            // 1 fetch paralelo das 3 listas
  reevaluate(derivedAlerts): Promise<void>;    // chama upsertAlertsFn + re-hydrate alerts
  createAction(input): Promise<Action>;        // chama createActionFn + atualiza local
  transitionAction(id, status): Promise<void>;
  dismissAlert(id): Promise<void>;
  // ... follow-ups / comments / attachments
}
```

**Anti-loop**:
- Único `hydrate` por `(tenantId)` controlado por `hydratedForTenant`.
- Mutations chamam o server e fazem **patch local** (sem refetch).
- Sem subscriptions cruzadas com outros stores.
- Hook `useDecisionAlerts(window)` apenas projeta `alerts` filtrados pela janela — não dispara reavaliação.

Hooks de conveniência em `src/hooks/`:
- `useDecisionHydration()` — chamar uma vez no AppShell quando o tenant selecionado mudar.
- `useWatchlist({ pinnedOnly?, due? })`
- `useAlertActions(alertId)`

---

## Compatibilidade com o que já existe

| Hoje | Depois desta fase |
|---|---|
| `decisionData.ts → useDecisionData()` deriva alertas em memória via `evaluateRules`. | Mantido. Vira a **fonte** do `reevaluate()`, que persiste o resultado em `decision_alerts`. |
| `actionStore` + `client_actions` (renegotiation/cap_adjustment/cluster_change/mini_rfp/communication). | Mantido intocado. É a camada de "executar mudança operacional" (cria batch de renegociação, ajusta cap, etc.). |
| `RecommendedActionsModal` dispara `useActionStore.executeAction(...)`. | Mantido. Numa fase futura, esse `executeAction` também escreverá um `decision_action(type=ADD_TO_PIPELINE, ...)` para alimentar a watchlist. Não é feito agora pra não mexer em UI. |

Ou seja: **duas camadas convivem**:
1. **Operacional/Decision Center novo** (alertas materializados + ações de comunicação/follow-up + watchlist) — esta fase.
2. **Execução de mudanças de portfólio** (legado actionStore) — segue como está, será conectado depois.

---

## Entregáveis desta fase

1. **Migração SQL** com as 6 tabelas, índices, GRANTs, RLS, trigger `decision_actions → decision_watchlist` e CHECK em `decision_comments`.
2. `src/lib/decision.functions.ts` — todas as server fns acima.
3. `src/lib/decisionStore.ts` — store Zustand.
4. `src/hooks/useDecisionHydration.ts`, `src/hooks/useWatchlist.ts`, `src/hooks/useAlertActions.ts`.
5. Atualização do `recommendationEngine` para emitir o `signature` determinístico (sem mudar a lógica).
6. **Nada de UI**. Nada removido. Nada de placeholder.

Ao final eu envio um resumo curto da arquitetura aplicada e os próximos módulos sugeridos.

---

## Decisões abertas (quero confirmar antes de migrar)

- **Migrar o `actionStore` legado para o novo modelo?** Proponho **não** nesta fase — alto risco, zero retorno imediato. Conectar depois.
- **Anexos**: reusar o bucket `baseline-files` em pasta `decision/...` (proposto) ou criar bucket próprio `decision-files`? Bucket próprio é mais limpo mas custa uma migração extra.
- **Alerts dedupe**: ok com `signature` (hash de tipo + escopo + período) para idempotência? Alternativa é só `created_at` mais recente vence.

Se você só responder "vai", eu sigo com: actionStore legado intocado, reusar `baseline-files`, dedupe por `signature`.