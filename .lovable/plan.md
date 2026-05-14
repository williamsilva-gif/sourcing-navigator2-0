
## Resposta curta

**Não recomende o começar do zero.** A base (TanStack Start + Lovable Cloud, schema, RLS, rotas) está sólida. Os bugs que você descreve são todos sintomas do **mesmo punhado de causas raiz** — uma vez corrigidos, o app para de "piscar" e os dados passam a salvar. Recomeçar custaria os 15 mil hotéis já migrados e o esquema multi-tenant com RLS que já funciona.

## Causas raiz identificadas

1. **Não há roteamento por papel após login.** `landingForRole()` existe em `useAuth.ts` mas não é chamado em lugar nenhum no fluxo de login/signup. Resultado: hotel cai no dashboard da TA (`/` mostra "Bom dia, Marina" e o KPI da TA para qualquer usuário).
2. **Index `/` é o dashboard da TA, sem guarda de papel.** Precisa redirecionar (ou renderizar variantes) conforme `getPrimaryRole(roles)`.
3. **Race condition de sessão Supabase em chamadas server-fn.** O `attachSupabaseAuth` já está em `src/start.ts`, mas server functions são chamadas antes de `supabase.auth.getSession()` resolver no cliente — daí o famoso `Unauthorized: No authorization header provided` na migração e em outras chamadas. Não há um `useAuthReady` gating.
4. **Dados aparentam "sumir/aparecer" e "não atualizar"** porque o app mistura **state local (Zustand: baselineStore, snapshotStore, clientsStore)** com **dados reais do Supabase**. Componentes leem de stores que nunca foram hidratados a partir do banco — então conforme rotas remontam, ora mostram local, ora vazio, ora DB.
5. **Erro de hidratação SSR** (visível no console): o avatar do Header renderiza iniciais "MR" no servidor e "WS" no cliente porque o componente lê `auth.user` (que no SSR é `null`). Isso causa o "tree will be regenerated" — visualmente parece "funcionalidades somem e aparecem".
6. **Migração de hotéis já está concluída no banco** (15.035 registros confirmados). O botão "Migrar para o banco" só falha porque a cópia local (`baselineStore`) ainda existe — basta limpar.

## Plano de correção (em ordem, sem recomeçar)

### Etapa 1 — Auth & roteamento por papel (resolve bugs 1, 2, 5)
- Adicionar `useAuthReady` com flag `ready` (sessão restaurada do storage).
- Em `routes/login.tsx` e `routes/signup.tsx`, após sucesso, aguardar `roles` e navegar via `landingForRole(getPrimaryRole(roles))`.
- Criar `_authenticated/index.tsx` (ou guarda em `routes/index.tsx`) que redireciona hotel→`/hotel/rfps`, TA/TMC/Corp→dashboard correspondente.
- Renderizar Header/Sidebar somente quando `ready === true` (eliminando o mismatch de iniciais SSR↔client).

### Etapa 2 — Anexar bearer ANTES da chamada (resolve bug 3)
- Em todo serverFn protegido (incluindo `bulkUpsertHotelsByCodeFn`), o cliente deve aguardar `supabase.auth.getSession()` resolver. Adicionar `await` explícito no `auth-attacher` já está OK; o problema é a chamada disparada de loaders/efeitos antes do `ready`. Solução: gate todas as chamadas server-fn por `useAuthReady`.

### Etapa 3 — Eliminar stores locais conflitantes (resolve bug 4)
- `baselineStore` (hotéis locais), `clientsStore` (clientes locais) e `snapshotStore` devem virar **read-through do Supabase** ou serem removidos.
- Para hotéis: já lemos do DB via `listHotels` — basta apagar `baselineStore.hotels` e o banner de migração.
- Para clientes: idem, ler de `tenants` (filtrado por `visible_tenant_ids`).
- Snapshot/decision data: pode continuar local se for derivado, mas precisa ser recomputado a partir do DB e não de cópia local.

### Etapa 4 — Limpeza pós-migração de hotéis
- Remover botão "Migrar para o banco" e o banner amarelo.
- Adicionar um único botão "Limpar cópia local" para usuários que ainda têm `baselineStore.hotels` no navegador.

### Etapa 5 — Verificação
- Testar 4 fluxos: signup como hotel → cai em `/hotel/rfps`; signup como corp → cai em `/`; login como TA master (você) → dashboard TA; refresh em `/hoteis` → 15.035 listados sem "piscar".
- Confirmar zero erros `Unauthorized` e zero hydration mismatch no console.

## O que NÃO vou mexer
- Schema do banco (tabelas, RLS, triggers — todos corretos).
- Os 15.035 hotéis já no DB.
- A integração Lovable Cloud / TanStack Start em si.

## Esforço estimado
- Etapas 1-2: ~1 iteração (núcleo do problema, resolve ~70% dos sintomas).
- Etapas 3-4: ~1-2 iterações (remoção de código morto e dual-source-of-truth).
- Etapa 5: validação rápida.

Total: 2-3 mensagens, **sem custo de recomeçar do zero** (que seria refazer schema, RLS, upload de hotéis, etc.).

Confirma que quer seguir por esse caminho? Se sim, começo pela Etapa 1 (auth ready + roteamento por papel) que sozinha já resolve o bug de "hotel virou TA" e o flicker.
