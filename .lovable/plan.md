# Plano

## 1. Restaurar visibilidade do menu Admin para o TA

**Sintoma:** Logado como `william.silva@travelacademy.com.br` (TA master), apenas o link "TA Console" aparece — o item "Admin" sumiu da sidebar.

**Causa:** `src/components/layout/Sidebar.tsx` filtra o item Admin por `role === "admin" && enabledModules.admin`, lendo da store legada `appConfigStore` (zustand persistido em localStorage). Como agora o login real popula `useAuth().roles` (não a store legada), TA não passa mais por esse filtro. Além disso, se o módulo `admin` foi desabilitado em alguma sessão anterior, o flag persistido bloqueia o link mesmo com role correto.

**Correção (somente UI/presentation):**
- Em `Sidebar.tsx`, considerar também o papel real vindo de `useAuth()`: mostrar "Admin" quando `primaryRole` é `ta_master`/`ta_staff` (ou quando o legacy `role === "admin"` continuar valendo, para retrocompatibilidade).
- Não tocar no gating do `enabledModules.admin` por enquanto — apenas garantir que TA não dependa do role legado.

## 2. Pipeline de CI (GitHub Actions)

Criar `.github/workflows/test.yml`:
- Triggers: `push` e `pull_request` em qualquer branch.
- Runner: `ubuntu-latest`, instala `bun`.
- Passos: `bun install --frozen-lockfile` → `bun run test`.
- Envs (lidas de GitHub Secrets do repositório): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`.
- Falha o job se qualquer teste vitest quebrar (default — `bun run test` retorna não-zero).
- Documentar os 3 secrets necessários num bloco no `README` ou nota no próprio workflow (comentário no topo).

> Observação: a execução real depende do usuário cadastrar esses secrets no GitHub. Se faltarem, o setup do `tests/rls.integration.test.ts` (que dá `throw` quando ausentes) faz o build falhar — comportamento desejado.

## 3. Novos testes de integração

Criar 3 novos arquivos de teste em `tests/`, todos seguindo o mesmo padrão do `rls.integration.test.ts` existente (service-role admin para setup/teardown, clientes anon autenticados para validar RLS, prefixo `rlstest+` + `RUN_ID` para isolamento e cleanup).

### 3.1 `tests/ta-invite.integration.test.ts`
Cobre o fluxo de promoção de TA staff feito no `ta.clients.tsx`:
- Cria um usuário "convidado" via signup público como HOTEL.
- Autentica como TA master (usa o seed `william.silva@travelacademy.com.br` se existir; caso contrário cria/promove um TA master via service-role no setup) e insere em `user_roles` o par `(invitee.id, root_ta_tenant.id, 'ta_staff')` — exatamente como faz o handler `handleInviteTaStaff`.
- Verifica:
  - Insert succeeds quando autor é TA master.
  - Mesmo insert é bloqueado por RLS quando autor é CORP/HOTEL/TMC qualquer.
  - Após promoção, o convidado consegue ler todos os tenants (`is_ta_master` retorna true → `visible_tenant_ids` cobre tudo).
  - `handle_new_user` continua não atribuindo `ta_*` no signup público (já coberto, mas reafirmamos cross-checking).

### 3.2 `tests/bookings-cross-tenant.integration.test.ts`
Foca em UPDATE/DELETE cross-tenant em `bookings` (o teste atual cobre INSERT/SELECT):
- Setup: cria `corpA`, `corpB`, ambos `corp_admin` do próprio tenant; CorpA insere 1 booking marcado.
- CorpA UPDATE no próprio booking → sucesso (linha alterada).
- CorpA UPDATE no booking de CorpB → 0 linhas afetadas (RLS filtra silenciosamente em UPDATE; conferimos via `select count` pós-update via service role).
- CorpA DELETE no próprio booking → bloqueado (não há policy DELETE para corp; só TA master deleta) — confere `error` ou `count=0`.
- CorpA DELETE no booking de CorpB → 0 linhas afetadas.
- TA master DELETE em qualquer booking → sucesso.

### 3.3 `tests/tmc-signup.integration.test.ts`
- Cria usuário via `auth.admin.createUser` com `account_type=TMC` e `org_name`.
- Verifica:
  - Existe exatamente 1 row em `tenants` com aquele `name` e `type='TMC'`.
  - Existe 1 `user_roles` para o usuário com `role='tmc_admin'` apontando para esse tenant.
  - `profiles.primary_tenant_id` aponta para esse tenant.
- Cross-isolation:
  - TMC_A não enxerga `tenants` de TMC_B (`select` retorna 0 rows).
  - TMC_A não consegue inserir booking no `client_tenant_id` de TMC_B (RLS rejeita).
  - HOTEL_A não enxerga tenant de TMC_A.
  - TMC_A pode inserir um child CORP via policy `TMC can insert child tenants` (positivo) e CorpA não consegue (negativo).

## 4. Arquivos afetados

- **Editar:** `src/components/layout/Sidebar.tsx` (lógica de visibilidade do item Admin).
- **Criar:** `.github/workflows/test.yml`.
- **Criar:** `tests/ta-invite.integration.test.ts`, `tests/bookings-cross-tenant.integration.test.ts`, `tests/tmc-signup.integration.test.ts`.

Sem migrações novas — todas as policies necessárias já existem no schema atual.

## 5. Validação

- Rodar `bun run test` localmente após cada novo arquivo de teste para confirmar que passa antes de commitar.
- Conferir no preview que o item "Admin" aparece de novo na sidebar quando logado como TA master.

Confirme para eu implementar (ou ajuste pontos do plano se algo não estiver como esperado).
