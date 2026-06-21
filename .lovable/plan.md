# Restaurar a listagem de clientes no Admin

## Diagnóstico

**Nenhum cliente foi apagado.** Confirmado no banco: Travel Academy, Kontik Viagens, Viagens Internas Kontik, Acme Travel Corp e Deloitte continuam lá, com os papéis de usuário preservados.

O problema é de **sessão/autenticação na chamada**, não de dados:

- A request `GET /rest/v1/tenants?type=neq.TA` está sendo enviada com `Authorization: Bearer <anon_key>` em vez do JWT do usuário logado.
- Sem JWT, `auth.uid()` é `NULL` no Postgres → a função `visible_tenant_ids()` retorna vazio → RLS esconde todas as linhas → a UI mostra "nenhum cliente".

Isso passou a acontecer junto com as últimas mudanças (guard de `must_set_password`, rota `/set-password`, novos hooks `useEffectiveAccess`). Algo nesse fluxo está:
(a) derrubando/limpando a sessão do Supabase no client, ou
(b) disparando o `listVisibleTenants` antes da sessão estar pronta, ou
(c) o `onAuthStateChange` no `__root.tsx` está invalidando queries em `SIGNED_OUT`/`TOKEN_REFRESHED` e refazendo a chamada sem token.

## O que vou fazer

1. **Investigar a causa raiz da sessão** lendo, na ordem:
   - `src/routes/_authenticated.tsx` (guard novo de `must_set_password`)
   - `src/routes/set-password.tsx`
   - `src/routes/__root.tsx` (handler de `onAuthStateChange`)
   - `src/hooks/useEffectiveAccess.ts` e `src/hooks/useFeatureEnabled.ts` (se algum efeito chama `supabase.auth.signOut` indevidamente)
   - Possível chamada server-fn em loader público que estoura 401 e zera a sessão

2. **Corrigir o ponto que está derrubando/atrasando a sessão**. Cenários prováveis e suas correções:
   - Guard de `must_set_password` lendo metadata errado → ler de `user.user_metadata.must_set_password` consistente com o que o `inviteTenantUserFn` grava; só redirecionar quando `data.user` existe.
   - `onAuthStateChange` invalidando queries em `SIGNED_OUT` → filtrar para só `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` e não refazer queries protegidas após logout.
   - `ClientsPanel` chamando `listVisibleTenants` antes da sessão (usar `enabled: !!session` no `useQuery` ou aguardar `_authenticated` resolver).

3. **Validar via Playwright headless** no `localhost:8080`:
   - Restaurar a sessão do TA com `LOVABLE_BROWSER_SUPABASE_*`.
   - Navegar para `/admin` e confirmar que os 5 tenants aparecem.
   - Confirmar que a request `GET /tenants` agora vai com `Authorization: Bearer eyJ...` (JWT do usuário), não com a anon key.
   - Screenshot da lista populada.

4. **Não tocar em schema nem em dados.** Nada de migration. Nada de seed. Apenas frontend/guards.

## Detalhes técnicos

- Arquivos suspeitos (a confirmar na investigação): `src/routes/_authenticated.tsx`, `src/routes/__root.tsx`, `src/routes/set-password.tsx`, `src/components/admin/ClientsPanel.tsx`, `src/lib/tenantsRepo.ts`.
- Critério de "feito": request de `/tenants` retorna 5 linhas (4 não-TA) com JWT do usuário; UI do `/admin` lista Kontik, Viagens Internas Kontik, Acme Travel Corp e Deloitte; nenhum dado tocado no banco.
