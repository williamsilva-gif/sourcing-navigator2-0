
# Plano — Acessos por Camada (TA → TMC → Corporativo → Hotel)

## Visão geral
Ativar Lovable Cloud, modelar isolamento multi-tenant no PostgreSQL com RLS, migrar tudo que hoje vive em `localStorage` para o banco, e criar UIs específicas por camada — sem perder o que já funciona (RFP, leilão reverso, cadastro de hotéis com Maps, POIs, upload em massa).

## 1. Backend — Lovable Cloud

Ativar Cloud (Postgres + Auth). Email/senha como método inicial. Magic-link habilitado para convites (hotéis e clientes).

## 2. Modelo de dados (esquema multi-tenant)

```text
tenants               (id, type: 'TA'|'TMC'|'CORP'|'HOTEL', name, parent_tenant_id, billing_status, terms_accepted_at)
profiles              (id=auth.uid, tenant_id, full_name, email)
user_roles            (user_id, tenant_id, role: 'ta_master'|'tmc_admin'|'tmc_user'|'corp_admin'|'corp_user'|'hotel_user')
tenant_modules        (tenant_id, module_key, enabled)        -- App Configuration por tenant
tenant_thresholds     (tenant_id, key, value)
hotels                (id, tenant_id_owner=hotel tenant, name, cnpj, address, lat, lng, contacts jsonb, ...)
hotel_members         (hotel_id, user_id, role)               -- rede com vários hotéis
bookings              (id, client_tenant_id, ...)             -- baseline atual migrado
rfps                  (id, client_tenant_id, created_by_tenant_id, deadline, status, pois jsonb, ...)
rfp_invitations       (rfp_id, hotel_id, status, deadline)
rfp_responses         (rfp_id, hotel_id, rates jsonb, submitted_at)
auctions              (id, rfp_id, ...)                       -- leilão reverso preservado
billing_events        (tmc_tenant_id, client_tenant_id, event_type, occurred_at, terms_version)
```

Função `has_role(_uid, _role, _tenant)` SECURITY DEFINER → usada em todas as policies (evita recursão).

## 3. Regra de isolamento (RLS resumida)

- **TA (`ta_master`)**: vê tudo (`bypass via has_role`).
- **TMC**: vê seu próprio tenant + tenants filhos onde `parent_tenant_id = tmc_id`.
- **Corp**: vê apenas registros onde `client_tenant_id = seu tenant_id`.
- **Hotel**: vê apenas RFPs em `rfp_invitations` ligados ao seu `hotel_id` + seu próprio cadastro.

Toda tabela com `client_tenant_id` ganha policy de SELECT/INSERT/UPDATE baseada na função.

## 4. Auth e roteamento

- Layout `_authenticated` com `beforeLoad` redirect para `/login`.
- Sub-layouts por camada: `_ta`, `_tmc`, `_corp`, `_hotel` (cada um valida role via `has_role`).
- Login único `/login`; após auth, redireciona pelo role principal.
- Páginas novas:
  - `/login`, `/signup` (público — só hotéis podem auto-cadastrar)
  - `/invite/$token` (aceita magic-link de hotel ou cliente)
  - `/ta/clients` (TA gerencia TMCs e clientes diretos)
  - `/tmc/clients` (TMC gerencia seus clientes + aceita T&C por cliente novo → grava `billing_events`)
  - `/hotel/onboarding` (busca hotel existente OU cadastra novo com Maps)
  - `/hotel/rfps` (lista RFPs ativos com prazo destacado, formulário de submissão de tarifas individual e em massa por rede)
  - `/hotel/profile` (CNPJ, contatos, edição cadastral — reusa `HotelForm`)

Header: dropdown "Tenant ativo" mostra apenas tenants visíveis ao usuário; troca → atualiza contexto e queries.

## 5. Migração dos dados demo → Acme real

Server function `seedAcmeDemoData()` (idempotente, só roda 1× por tenant):
1. Cria tenant `acme` tipo CORP, sem parent (cliente direto da TA).
2. Importa os 500 bookings já gerados em `demoData.ts` para `bookings` com `client_tenant_id=acme`.
3. Cria os hotéis demo em `hotels` (tenant_owner = hotel tenants individuais).
4. Cria 1 RFP demo + invitations + 1 leilão reverso de exemplo.
5. Marca `tenant_settings.demo_seeded=true`.

Stores Zustand viram cache local apenas; fonte da verdade passa a ser Supabase via `createServerFn` + React Query.

## 6. Login master TA

Após Cloud ativo: criar usuário `william.silva@travelacademy.com.br` (você define a senha no primeiro login via "esqueci senha"), atribuir `ta_master`, vinculado ao tenant TA raiz. Toda alteração feita por esse login cascateia (módulos habilitados, thresholds default, T&C vigente).

## 7. Billing — só registro

- Modal de T&C ao TMC criar cliente; grava `billing_events(event_type='client_created', terms_version)`.
- Painel TA `/ta/billing` lista eventos + export CSV para Financeiro. Sem Stripe agora.

## 8. Preservação do que existe

Tudo continua funcionando, agora com tenant_id:
- HotelForm + Maps + autocomplete + POIs ✅
- Upload em massa de hotéis ✅
- RFP wizard com POIs e raio ✅
- Leilão reverso ✅
- Diagnóstico/Dashboard/Análise ✅ (queries filtradas por tenant ativo)

## 9. Segurança
- Service role só em `*.server.ts`, nunca em loaders/componentes.
- `requireSupabaseAuth` em toda server function de leitura/escrita.
- Scan de segurança ao final.

## 10. Entregáveis em ordem

1. Ativar Cloud
2. Migrations: tabelas + RLS + função `has_role` + seed TA tenant + usuário master
3. `_authenticated` layout + login/signup/invite + redirect por role
4. Migração baseline → Acme (server fn idempotente)
5. UI TA (clientes, billing, app config global)
6. UI TMC (clientes, T&C, app config delegado, dropdown cliente ativo)
7. UI Corp (já existe — só plugar nos dados reais com filtro por tenant)
8. UI Hotel (onboarding, RFPs com prazo destacado, submissão de tarifas individual + rede, perfil)
9. Conectar RFP/Leilão/Diagnóstico/Análise às queries reais
10. Security scan + ajustes

## Notas técnicas
- Stores Zustand persistidos em localStorage viram cache de UI (cliente ativo, filtros), não fonte de verdade.
- `appConfigStore` e `clientsStore` deixam de ser autoritativos; viram seletores derivados de `tenants`/`tenant_modules` carregados do banco.
- `routeTree.gen.ts` regenerado automaticamente — não editar.
- Auto-seed atual em `baselineStore` precisa ser desativado quando o usuário estiver autenticado.
