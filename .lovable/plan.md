
# Reformulação Multi-Tenant + Permissões Granulares

Hoje o app trata todos os usuários iguais: qualquer cliente selecionado no Admin reescreve módulos/regras globais, o TA (William) entra "logado" em um cliente, não há criação de usuários, novos clientes herdam dados de demo e só dá pra ligar/desligar módulos inteiros. Esta entrega corrige tudo isso em 6 frentes.

---

## 1. Workspace pessoal do TA (William = Owner global)

- Detectar `ta_master`/`ta_staff` via `useAuth` e isolar um **workspace TA** que NÃO aparece no seletor de clientes.
- Ao logar como TA, entrar direto no workspace pessoal (não em cliente algum). Para mexer num cliente, o TA precisa explicitamente entrar em "Modo cliente" via um switcher no header.
- **Sidebar do workspace TA (default):** apenas Admin, Documentação e Hotéis. TA pode habilitar outros módulos no próprio workspace via Admin → Módulos (sem afetar clientes).
- **Modo cliente (impersonate):** banner persistente no topo "Visualizando como {Cliente} — sair do modo cliente". Toda mudança feita no Admin enquanto em modo cliente afeta APENAS aquele cliente.
- Owner global: TA enxerga e edita módulos, regras, papéis, feature flags e dados de TODOS os clientes, sem que isso contamine o workspace dele.

## 2. Criação de usuários (TA cria + auto-criação no 1º acesso)

- **TA cria usuário para um cliente:** nova aba Admin → "Usuários do cliente" (visível só em modo cliente para TA). Form: email + papel (`tmc_admin`, `tmc_manager`, `tmc_viewer`, `corp_admin`, etc.). Server fn protegida envia magic link / convite via Supabase Auth Admin API e grava `user_roles` com o `tenant_id` do cliente ativo.
- **Auto-criação no 1º acesso:** trigger `handle_new_user` já cria tenant + papel quando `account_type` vem no signup. Manter esse fluxo para auto-onboarding direto.
- TA também pode listar / remover / mudar papel dos usuários de cada cliente.

## 3. Novo cliente nasce zerado (exceto Hotéis)

- Hoje a Deloitte veio com RFPs porque algum fluxo está semeando demo data. Garantir que **criar cliente NÃO chama `seedDemoDataFn`**.
- `seedDemoDataFn` permanece disponível como ação manual em Admin → Clientes ("Popular com dados demo") — opt-in, nunca automático.
- Hotéis são globais (catálogo TA), então continuam visíveis.

## 4. Config por cliente é por cliente — não global

- `useAppConfigStore` já guarda `configByClient[id]`, mas o Admin atual está editando o cliente "selecionado" globalmente, o que confunde o TA.
- Mudanças:
  - Admin → seletor explícito "Editando configuração de: [Cliente X ▾]" no topo da página, independente do cliente ativo na navegação.
  - No workspace TA, esse seletor inclui "Meu workspace (TA)" para o TA editar os próprios módulos.
  - `RolesPanel` deixa de editar o usuário global; passa a editar membros do cliente selecionado (lista vinda de `user_roles` + `profiles`).

## 5. Feature flags por funcionalidade (não só por módulo)

Hoje só dá pra desligar o módulo RFP inteiro. Precisamos granularidade dentro de cada módulo.

- Novo conceito `FeatureKey` no store: `rfp.create`, `rfp.viewDetails`, `rfp.invite`, `negociacao.createLot`, `negociacao.reverseAuction`, `selecao.export`, `hoteis.create`, `hoteis.edit`, `admin.users`, etc. Catálogo declarado em `src/lib/featureCatalog.ts` (módulo → lista de features com label + default).
- `useAppConfigStore.configByClient[id].features: Record<FeatureKey, boolean>` (default: tudo `true`; cliente novo herda defaults).
- Nova aba **Admin → Funcionalidades**: tabela agrupada por módulo com switches por feature, editável apenas por TA / admin do cliente.
- Hook `useFeatureEnabled(key)` + componente `<Feature flag="rfp.create">…</Feature>` para gating na UI. Botões como "Novo RFP" usam isso; "Detalhes" não.
- Server fns sensíveis (criar RFP, criar lote, etc.) também checam a flag do tenant via uma função SQL `has_feature(tenant_id, key)` para que desabilitar na UI não seja contornável.

## 6. Persistência das configs no banco

Hoje `appConfigStore` mora só no `localStorage`. Para o TA gerenciar configs de clientes de qualquer máquina, mover para DB:

- Usar `tenant_modules` (já existe) para módulos habilitados.
- Nova tabela `tenant_features (tenant_id, feature_key, enabled)` com RLS: TA master vê tudo; admin do tenant vê o próprio; demais leem via função `is_feature_enabled`.
- `appConfigStore` vira camada de cache; leitura/escrita via server fns (`getTenantConfigFn`, `setTenantModuleFn`, `setTenantFeatureFn`).

---

## Detalhes técnicos

### Arquivos a alterar / criar
- `src/lib/appConfigStore.ts` — adicionar `features`, separar "cliente sendo editado" de "cliente ativo na navegação"; workspace TA tratado como tenant especial.
- `src/lib/featureCatalog.ts` (novo) — catálogo de features por módulo.
- `src/hooks/useFeatureEnabled.ts` + `src/components/common/Feature.tsx` (novo).
- `src/components/layout/Sidebar.tsx` — modo TA workspace vs modo cliente; banner "modo cliente" no `Header.tsx`.
- `src/components/admin/*`
  - `ClientsPanel.tsx`: separar criação do seed; botão "Popular demo" opt-in.
  - `ModulesPanel.tsx`: seletor "editando config de…"; ler/gravar via server fn.
  - `RolesPanel.tsx`: virar gerenciador de membros do tenant selecionado.
  - `FeaturesPanel.tsx` (novo).
  - `TenantUsersPanel.tsx` (novo) — convidar/remover usuários.
- `src/routes/admin.tsx` — nova aba "Funcionalidades" + "Usuários".
- `src/lib/tenantUsers.functions.ts` (novo) — convidar, listar, atualizar papel, remover (server fns com `requireSupabaseAuth` + checagem `is_ta_master` ou `tmc_admin`/`corp_admin` do tenant).
- `src/lib/tenantConfig.functions.ts` (novo) — get/set módulos e features.
- Migração:
  - `tenant_features` (com GRANTs + RLS).
  - `has_feature(_tenant_id, _key)` SECURITY DEFINER.
  - Garantir GRANTs/RLS coerentes com o padrão do projeto.

### Comportamento esperado
- TA loga → cai no workspace pessoal (sidebar: Admin, Documentação, Hotéis).
- Header mostra switcher: "Workspace TA ▾" → "Entrar como Deloitte". Ao entrar, banner amarelo "Modo cliente: Deloitte — sair".
- Admin sempre exibe "Configurando: …" para deixar claro o escopo da edição.
- Criar "Deloitte" → cliente vazio (sem RFPs, sem bookings). Para popular, clicar "Popular com dados demo".
- TA pode desligar "Novo RFP" para Deloitte: usuários Deloitte continuam vendo a lista e os Detalhes, mas o botão "Novo RFP" some e a server fn rejeita.
- TA cria usuário `joao@deloitte.com` como `corp_admin` da Deloitte → João recebe magic link, no 1º acesso já cai logado no tenant Deloitte.

### Fora de escopo desta entrega
- Auditoria/log de mudanças de feature flags.
- Permissões por usuário (continua por papel + tenant).
- UI mobile do switcher de cliente (foco em desktop).
