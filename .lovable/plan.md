## Diagnóstico

Verifiquei o banco e os stores. Resumo objetivo do que está acontecendo:

### ✅ O que ESTÁ salvo no banco
- **RFPs**: 3 registros existem no banco (`rfps`), 11 convites (`rfp_invitations`). O fluxo de criação grava corretamente via `createRfpFn`. Quando o usuário "criou e não viu nada", o problema é de UX (modal não fecha / não navega), não perda de dados.
- **Hotéis**: 15.032 registros.
- **Tenants/Clientes**: 4 registros.
- **Convites e respostas de RFP**: salvos no banco.

### ❌ O que NÃO está no banco (mora só no localStorage do navegador)
Quatro stores Zustand persistem em `localStorage`. Ao deslogar, trocar de navegador ou limpar cache, **tudo se perde**:

| Store | Chave localStorage | O que guarda |
|---|---|---|
| `baselineStore` | `sourcinghub.baseline.v1` | **Bookings, hotéis ingeridos, contratos, histórico de uploads** (Diagnóstico mostra 0 no banco) |
| `actionStore` | `sourcinghub.actions.v1` | **Ações realizadas pelos clientes** (renegociação, ajuste de cap, mini-RFP, comunicações) |
| `appConfigStore` | `sourcinghub.appconfig.v1` | Thresholds, módulos habilitados, configs por cliente |
| `clientsStore` | `sourcinghub.clients.v1` | Cache local de tenants (tenants já estão no DB; só o cache é local) |

Bookings no banco hoje: **0**. Tudo que foi carregado em Diagnóstico está só no navegador atual.

---

## Plano de correção

Vou migrar os 3 stores críticos para o banco (Cloud) com persistência real, mantendo a UX atual (Zustand fica como cache de leitura, mas a fonte da verdade passa a ser o banco). Vou dividir em fases para não quebrar nada.

### Fase 1 — Persistir bookings, hotéis ingeridos e contratos (baseline)
Criar tabelas:
- `baseline_uploads` (id, tenant_id, type, filename, uploaded_at, row_count, error_count, status, errors[])
- `baseline_hotels_raw` (id, tenant_id, code, name, city, …, upload_id)
- `baseline_contracts` (id, tenant_id, hotel_code, city, adr_cap, …, upload_id)
- A tabela `bookings` já existe — usar ela direto, ligada ao `client_tenant_id`.

Server functions: `ingestBookingsFn`, `ingestHotelsFn`, `ingestContractsFn`, `listBookingsFn`, `listUploadsFn`, `deleteUploadFn`.
`baselineStore` passa a chamar essas funções; localStorage vira só cache curto. Sem migração de dados antigos do localStorage (o usuário re-faz o upload).

### Fase 2 — Persistir ações dos clientes
Criar tabela `client_actions` (id, tenant_id, kind, status, effort, payload jsonb, created_by, created_at, updated_at, completed_at) com RLS por `client_tenant_id`.
Server functions: `createActionFn`, `updateActionStatusFn`, `listActionsFn`, `deleteActionFn`.
`actionStore` migra para chamadas async; componentes que hoje chamam `useActionStore` continuam funcionando via wrapper.

### Fase 3 — Persistir thresholds e módulos por cliente
Já existem `tenant_thresholds` e `tenant_modules`. Substituir leitura/escrita do `appConfigStore` pelas tabelas existentes (server functions + React Query). Mantém UI igual.

### Fase 4 — Corrigir UX da criação de RFP
Garantir que ao concluir o wizard:
- toast de sucesso explícito;
- modal fecha;
- lista de RFPs é invalidada e re-aparece com a nova RFP;
- redireciona para a tela de detalhe da RFP criada.
(O dado já salva; é só fechar o loop visual.)

### Fase 5 — Avisos de segurança
- Adicionar mensagem clara nos uploads: "Os dados são salvos no servidor".
- Remover/avisar sobre o estado antigo em localStorage (limpar `sourcinghub.*.v1` na próxima carga após login para evitar mostrar dados desatualizados misturados com o do banco).

---

## Detalhes técnicos

- Tabelas novas usam RLS via `can_see_tenant(auth.uid(), tenant_id)` (mesmo padrão das tabelas existentes).
- Stores Zustand mantidos como camada de cache opcional; fonte da verdade = banco.
- Bookings de Diagnóstico passam a ser carregados via `useQuery` server fn, com paginação (já temos 1000 row limit do Supabase — implementar `range()` se necessário).
- Sem alteração nas tabelas existentes; só adição.

## Ordem de aprovação

Posso executar tudo numa sequência, mas se preferir aprovar uma fase por vez (Fase 1 é a mais urgente — é onde realmente há perda de dados de upload), só me dizer.

Quer que eu vá com tudo (Fases 1 → 5) ou começo só pela Fase 1 (baseline/uploads)?