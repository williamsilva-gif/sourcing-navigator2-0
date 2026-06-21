## Objetivo

Reestruturar "Usuários do cliente" para que **módulos e funcionalidades fiquem por usuário**, com template no cliente. Adicionar campo de nome no convite. Forçar criação de senha no 1º acesso. Garantir que módulos desativados sejam realmente bloqueados (incluindo no sidebar e roteamento) — não apenas escondidos no localStorage do TA.

---

## 1. Schema (migração)

Nova tabela `user_module_overrides` (por-usuário, opcional — sobrescreve template do cliente):

```text
user_module_overrides
  user_id (FK auth.users, cascade)
  tenant_id (FK tenants)
  module_key text
  enabled boolean
  PK (user_id, tenant_id, module_key)
```

Nova tabela `user_feature_overrides`:

```text
user_feature_overrides
  user_id, tenant_id, feature_key, enabled
  PK (user_id, tenant_id, feature_key)
```

Função SQL `effective_user_modules(_user_id, _tenant_id)` e `effective_user_features(...)` (SECURITY DEFINER) que aplicam: override do usuário → senão tenant_modules/tenant_features → senão default `true`.

Grants padrão + RLS: usuário lê só os próprios overrides; TA master tudo; tenant admin do tenant em questão.

`tenant_modules`/`tenant_features` permanecem como **template** aplicado a novos usuários.

## 2. Convite com nome + senha obrigatória

- `TenantUsersPanel`: adicionar campo **Nome completo** (obrigatório) ao lado do email.
- `inviteTenantUserFn`: aceita `fullName`, passa em `data.full_name` para `inviteUserByEmail` e grava em `profiles.full_name`. Define `data.must_set_password: true` no metadata.
- Nova rota pública `src/routes/set-password.tsx`:
  - Lê o token de recovery/invite do hash.
  - Mostra form "Defina sua senha".
  - `supabase.auth.updateUser({ password })`.
  - Limpa flag `must_set_password` e redireciona para `/`.
- Configurar template de convite (Lovable Cloud Auth) com `redirectTo` apontando para `/set-password`.
- Guard no `_authenticated/route.tsx`: se `user.user_metadata.must_set_password === true`, redirect para `/set-password`.

## 3. UI: mover módulos/features para debaixo do usuário

`TenantUsersPanel` vira **lista mestre-detalhe**:

```text
┌────────────── Usuários do cliente ──────────────┐
│ [Cliente: Deloitte ▼]    [+ Convidar usuário]   │
│                                                  │
│ ▸ William Reis  · corp_admin   [editar] [×]     │
│ ▾ Maria Souza   · corp_user                     │
│   ├─ Módulos habilitados (5 ativos de 11)       │
│   │   [x] Dashboard  [ ] RFP  [x] Análise ...   │
│   ├─ Funcionalidades por módulo                  │
│   │   RFP: [ ] Novo RFP  [x] Ver detalhes ...   │
│   └─ [Resetar para template do cliente]         │
└──────────────────────────────────────────────────┘
```

- Toggle de módulo grava em `user_module_overrides` via `setUserModuleFn`.
- Toggle de feature grava em `user_feature_overrides` via `setUserFeatureFn`.
- Botão "Resetar para template" = delete overrides do usuário.
- Painel "Módulos por cliente" (`ModulesPanel`) e "Funcionalidades" (`FeaturesPanel`) viram apenas **TEMPLATE PADRÃO** (aplicado a novos usuários do cliente). Label e copy ajustados.

## 4. Enforcement real (corrige bug Deloitte)

Hoje `useEnabledModules` lê do `useAppConfigStore` (localStorage do TA). Isso explica o bug: William logou como williamreis07 e o storage do navegador do TA não se aplica.

Mudanças:

- Novo `useEffectiveModules()` hook: server fn `getMyEffectiveAccessFn` (autenticado) que retorna `{ modules: Record<key, bool>, features: Record<key, bool> }` aplicando `effective_user_*` para o tenant ativo do usuário. Cacheado com React Query.
- `Sidebar.tsx` e roteamento (`_authenticated`) usam **esse hook** em vez de `useEnabledModules` do appConfigStore.
- Adicionar `beforeLoad` em cada rota de módulo: se `!effectiveModules[key]`, redirect para `/` com toast.
- `useFeatureEnabled` passa a ler do mesmo cache.
- `appConfigStore` continua existindo, mas só para o **TA editando configs do cliente** — não para enforcement de acesso de outros usuários.

## 5. Arquivos

**Migração:**
- `supabase/migrations/<ts>_user_overrides.sql` — tabelas, RLS, GRANTs, `effective_user_modules`, `effective_user_features`.

**Server fns:**
- `src/lib/tenantUsers.functions.ts` — adicionar `fullName` no schema; novas fns `setUserModuleFn`, `setUserFeatureFn`, `resetUserOverridesFn`, `getUserOverridesFn`.
- `src/lib/access.functions.ts` (novo) — `getMyEffectiveAccessFn`.

**Hooks:**
- `src/hooks/useEffectiveAccess.ts` (novo) — React Query wrapper.
- `src/hooks/useFeatureEnabled.ts` — passa a usar `useEffectiveAccess`.

**UI:**
- `src/components/admin/TenantUsersPanel.tsx` — expansível com módulos+features por usuário, campo Nome.
- `src/components/admin/ModulesPanel.tsx` / `FeaturesPanel.tsx` — copy "(template padrão para novos usuários)".
- `src/components/layout/Sidebar.tsx` — usar `useEffectiveAccess`.
- `src/routes/_authenticated/route.tsx` — guard `must_set_password` + carregar effective access no contexto.
- `src/routes/set-password.tsx` (novo) — form de senha.

## 6. Validação

- Login como williamreis07 → ver só módulos habilitados para ele (template Deloitte ∩ overrides).
- Convite novo → recebe email → /set-password obriga senha → entra com profile.full_name preenchido.
- TA desativa "RFP" só para um usuário específico → outros usuários da Deloitte mantêm acesso.
- TA edita template Deloitte → afeta novos usuários, não os existentes (a menos que clique "Resetar overrides").

