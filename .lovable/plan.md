## Objetivo

Garantir que **nenhum dado importante viva apenas no navegador**. Hoje há três áreas que persistem em `localStorage` e uma delas (configuração por cliente) **não tem espelho no banco** — é a fonte real de risco. As outras duas (clientes, ações) já vão ao banco, mas o `localStorage` pode mascarar staleness/perda em outro dispositivo.

## O que está em risco hoje

1. **`appConfigStore` (CRÍTICO — só no navegador)**
   Salva por cliente: thresholds, `defaultCap`, `environment`, módulos habilitados e feature flags. Se você limpar o navegador ou abrir em outra máquina, **essas configurações somem**. As tabelas `tenant_modules`, `tenant_features` e `tenant_thresholds` já existem no banco mas o app não as usa — apenas o painel admin lê/grava em paralelo, deixando duas fontes da verdade.

2. **`actionStore` (OK no banco, cache no LS)** — já grava e relê do banco; o `localStorage` é cache.

3. **`clientsStore` (OK no banco, cache no LS)** — já grava e relê do banco; o `localStorage` é cache.

4. **`consentManager`** — espelha em `consent_logs` quando autenticado; sem login fica só no LS (aceitável para visitante anônimo).

## Plano

### 1. Migrar `appConfigStore` para o banco (fonte da verdade = DB)

- Adicionar duas colunas em `public.tenants`: `environment text` (TMC/Corporate/Supplier) e `default_cap numeric`. Backfill com os valores atuais (`TMC` / `280`).
- Passar a ler/gravar:
  - **Thresholds** → `tenant_thresholds` (chaves `adrGapPct`, `compliancePct`, `leakagePct`, `concentrationPct`).
  - **Módulos habilitados** → `tenant_modules` (já em uso pelo admin).
  - **Features** → `tenant_features` (já em uso pelo admin).
  - **Environment / defaultCap** → colunas novas em `tenants`.
- Criar server functions (`createServerFn` com `requireSupabaseAuth`) `getTenantConfigFn` e `setTenantConfigFn` para leitura/gravação atômica.
- `appConfigStore` deixa de persistir em `localStorage`. Passa a:
  - Hidratar do DB quando muda o cliente ativo (igual `actionStore`/`baselineStore`).
  - Cada `set*` chamar a server function (otimista; rollback em erro com toast).
- O workspace TA (`__ta_workspace__`) continua local em memória pois não é um tenant real, mas suas únicas configurações são derivadas de constantes do código — nada a perder.

### 2. Tirar o `localStorage` dos stores que já têm DB

- Remover o middleware `persist` de `clientsStore` e `actionStore`. O DB já é a fonte; o cache no LS apenas cria janelas de inconsistência entre dispositivos/sessões e foi a raiz dos sumiços recentes.
- `selectedClientId` (apenas UI) passa para `sessionStorage` da aba — não é "dado", e some por aba sem prejuízo.
- Limpar as chaves antigas (`sourcinghub.clients.v1`, `sourcinghub.actions.v1`, `sourcinghub.appconfig.v1`, `sourcinghub.baseline.v1`, `sourcinghub.snapshot.v1`) no boot, uma vez, via o mesmo mecanismo de `PURGE_FLAG` já existente em `__root.tsx`.

### 3. Reforço — proibir novo `localStorage` para dados

- Adicionar comentário/aviso no topo de `appConfigStore`, `actionStore`, `clientsStore`: "Dados de negócio vão para o banco. Não reintroduzir `persist`/`localStorage`."
- Único uso legítimo restante de `localStorage`: sessão do Supabase (`client.ts`, auto-gerado — não tocar) e consent do visitante anônimo.

### 4. Validação

- Limpar `localStorage` do navegador → recarregar `/admin` autenticado como TA → ver os 4 clientes, ações executadas, thresholds, módulos e features carregarem direto do banco.
- Trocar de cliente → trocar de máquina (ou aba anônima após login) → configuração idêntica.
- Não há `DELETE` ou migração destrutiva — só `CREATE`/`ALTER ADD COLUMN` com defaults e backfill conservador.

## Detalhes técnicos

- Migração: `ALTER TABLE tenants ADD COLUMN environment text DEFAULT 'TMC' NOT NULL`, `ADD COLUMN default_cap numeric DEFAULT 280 NOT NULL`. Sem mudança de RLS (já coberto pelas policies de `tenants`).
- Server fns ficam em `src/lib/tenantConfig.functions.ts`.
- `useAppConfigStore` mantém a mesma API pública (`useThresholds`, `useEnabledModules`, etc.) — componentes não mudam. As actions viram `async` e mostram toast em falha.
- Nenhum dado existente é apagado. O backfill preserva o que já está em `tenant_modules`/`tenant_features`/`tenant_thresholds`; o que estiver só no `localStorage` de um usuário será sobrescrito pelo banco (que é o comportamento desejado para evitar "fantasmas" entre máquinas).
