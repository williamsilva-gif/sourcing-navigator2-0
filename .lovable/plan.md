# Migração completa: localStorage → banco

Hotéis já está no banco. Vou migrar o resto em **4 fases**, cada uma testável isoladamente. Faço uma fase por vez para você validar antes de seguir.

## Estado atual (o que ainda vive só no navegador)

| Store | Conteúdo | Tabela destino |
|---|---|---|
| `clientsStore` | Lista de clientes/empresas selecionáveis no header | nova `clients` (ou reusar `tenants`) |
| `baselineStore` | 500 bookings importados via XLSX, uploads | `bookings` (já existe) + nova `baseline_uploads` |
| `snapshotStore` | Versões salvas para comparação de cenários | nova `snapshots` |
| `appConfigStore` | Ambiente, módulos habilitados, user local | já há `tenant_modules`; resto fica local (preferência de UI) |
| Convites de usuários (TMC/CORP/HOTEL) | criados via UI hoje só localmente | usar `auth.admin.inviteUserByEmail` via server fn |

## Fase 1 — Clientes / TMCs / CORPs / Hotéis (entidades)

A tabela `tenants` já modela isso (TA / TMC / CORP / HOTEL com `parent_tenant_id`). Em vez de criar `clients`, **uso `tenants` como fonte da verdade** e aposento o `clientsStore`.

- Migration: nada novo (tabela existe). Verifico RLS de SELECT/INSERT.
- Repo `tenantsRepo.ts` com `listVisibleTenants()`, `createTenant()`, `updateTenant()`.
- Header passa a ler clientes de `tenants` via React Query.
- Banner de migração one-shot em `/admin` para subir os clientes do `clientsStore` antigo.
- Página `/ta/clients` (TA Console) já existe — conecto ao banco.

## Fase 2 — Bookings (baseline)

A tabela `bookings` já existe com RLS por `client_tenant_id`.

- Repo `bookingsRepo.ts` com `bulkInsert(rows, tenantId)` e `listByTenant`.
- Diagnóstico: ao importar XLSX, salvar direto em `bookings` (e não no zustand).
- Banner de migração no Diagnóstico para subir o baseline atual (500 linhas) ao tenant selecionado.
- Componentes do dashboard (`AdrHistogram`, `CityHeatmap`, etc.) passam a buscar via React Query do banco, com fallback para o store enquanto migração não roda.

## Fase 3 — Snapshots

- Migration: nova tabela `snapshots(id, tenant_id, name, payload jsonb, created_by, created_at)` com RLS `can_see_tenant`.
- Repo `snapshotsRepo.ts`.
- UI de Análise: salvar/listar snapshots vai ao banco.

## Fase 4 — Convite de usuários

- Server function `inviteUser({email, role, tenantId})` usando `supabaseAdmin.auth.admin.inviteUserByEmail` + `INSERT user_roles`.
- Restrita por `requireSupabaseAuth` + checagem de papel: `ta_master`/`ta_staff` pode convidar qualquer; `tmc_admin` só CORP/TMC_user no próprio tenant; `corp_admin` só CORP_user no próprio.
- UI em `/admin` (aba "Usuários") com formulário de convite.
- Testes de integração no padrão dos atuais (`tests/*.integration.test.ts`).

## Detalhes técnicos

- Padrão de migração one-shot já validado em `/hoteis` (banner amarelo + verificação de consistência) — replicado em cada fase.
- Onde RLS bloqueia `INSERT` (ex.: `tenants` só TA pode inserir), convites usam server fn com `supabaseAdmin`.
- React Query com `staleTime: 30s` para evitar refetch agressivo nos selects de cliente.
- Tipos vêm de `src/integrations/supabase/types.ts` (regenerado após cada migration).

## O que NÃO migra

- `appConfigStore.environment` (toggle dev/staging/prod) — preferência de UI, fica no navegador.
- `appConfigStore.user` (avatar/iniciais demo) — substituído pelo `useAuth().user` real.

## Ordem de entrega

1. Fase 1 (Clientes via `tenants`) — entrego, você valida.
2. Fase 2 (Bookings) — entrego, você valida.
3. Fase 3 (Snapshots) — entrego.
4. Fase 4 (Convites de usuários + testes) — entrego.

Confirma essa sequência? Posso começar pela Fase 1 imediatamente, ou prefere outra ordem (ex.: Convites primeiro porque você precisa criar usuários internos)?
