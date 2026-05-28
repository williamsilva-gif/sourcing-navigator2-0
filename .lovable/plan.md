## Objetivo

Para cada módulo (Decision Center, Diagnóstico, Estratégia, RFP, Análise, Negociação, Diretório de Hotéis), garantir:

1. **Dados demo realistas** usando os hotéis reais que já existem no módulo Hotéis (2024/2025/2026).
2. **Persistência em banco** (acabar com qualquer estado preso em `localStorage`/cookies para dados de negócio).
3. **Isolamento total por cliente** via RLS já existente (`can_see_tenant`) — cliente A nunca vê dado de cliente B; TMC fica vazia.

## Estado atual (mapeado)

| Módulo | Hoje persiste em | Ação |
|---|---|---|
| Decision Center | `decision_alerts/actions/watchlist/...` (DB ✅) + alerts derivados da baseline | Apenas seedar `bookings`+`contracts` por cliente para os 6 engines dispararem |
| Diagnóstico | `bookings` + `baseline_contracts` (DB ✅) | Seed por cliente. TMC fica vazia |
| Estratégia | `src/components/estrategia/strategyData.ts` (estático em código) + `tenant_thresholds` | Migrar tiering/caps/cluster para tabela `strategy_*` por tenant + seed |
| RFP | `src/lib/rfpRepo.ts` (DB ✅ — `rfps`/`rfp_invitations`/`rfp_responses`) + `rfpProgramData.ts` (mock) | Remover mock; seedar RFPs reais por cliente |
| Análise | `src/components/analise/rfpData.ts` (mock estático) | Criar tabela `rfp_analysis` (respostas comparadas) + seed |
| Negociação | `src/components/negociacao/negotiationData.ts` (mock estático) | Criar tabela `negotiation_lots` + `negotiation_messages` + seed. **Ocultar Leilão Reverso**. Adicionar **visão linha-a-linha** ao lado do Kanban |
| Seleção → Diretório de Hotéis | `selectionData.ts` (mock vazio) | Renomear módulo (label, rota mantida `/selecao` por compat, sidebar atualizado). Criar tabela `awarded_program` + seed por cliente |

## Plano em 4 fases

### Fase 1 — Schema (1 migration)
Criar tabelas com RLS `can_see_tenant`:
- `strategy_tiers (client_tenant_id, tier, brands[], qs_min, qs_max, share)`
- `strategy_caps (client_tenant_id, city, baseline_adr, suggested_cap, ...)`
- `strategy_clusters (client_tenant_id, name, hotels[], rationale)`
- `rfp_analysis_rows (client_tenant_id, rfp_id, hotel_id, city, current_adr, proposed_adr, savings, qs, compliance, recommendation)`
- `negotiation_lots (client_tenant_id, name, city, status, hotels_count, target_savings, owner, deadline)`
- `negotiation_threads (client_tenant_id, lot_id, hotel_id, current_offer, last_message_at, status)`
- `awarded_program (client_tenant_id, hotel_id, hotel, brand, city, tier, final_adr, cap, starting_adr, room_nights, qs, compliance, status primary|backup, contract_start, contract_end)`
- `demand_targets (client_tenant_id, city, target_nights)`

Todas com GRANTs e RLS por tenant. Cada CREATE TABLE seguido de GRANT + ENABLE RLS + POLICY (4 passos) conforme regra.

### Fase 2 — Repos + stores
- `strategyRepo.ts`, `analysisRepo.ts`, `negotiationRepo.ts`, `programRepo.ts` (espelhando `rfpRepo.ts`).
- Substituir os arquivos `*Data.ts` mock por hooks `useXxxData(clientTenantId)` que lêem do Supabase.
- Manter os tipos (não quebrar UI).

### Fase 3 — Seeder demo por cliente
Botão **"Carregar dados demo"** no painel admin (já existe `ClientsPanel`) que, dado um `client_tenant_id`, gera:
- ~600 bookings 2024 + ~700 bookings 2025 + ~200 bookings 2026 usando hotéis reais do tenant.
- Contratos baseline coerentes.
- Tiering/caps/clusters derivados.
- 2 RFPs (uma fechada com respostas → alimenta Análise; uma em andamento).
- 3 lotes de negociação com 2-3 threads cada.
- Programa final (`awarded_program`) com ~15 hotéis selecionados em 4-5 cidades.

**Variação por cliente**: cada cliente recebe um seed determinístico diferente (semente = hash do `client_tenant_id`) → ADRs, cidades dominantes, gaps de compliance distintos. **TMC** (tipo `TMC`) é pulada — fica vazia.

Disparo: 1 clique por cliente no Admin. Ou comando único "seedar todos os clientes corporativos".

### Fase 4 — Ajustes de UI
- **Negociação**: esconder aba/botão "Leilão Reverso" (`ReverseAuction.tsx` segue no código, mas removido da navegação). Adicionar **toggle Kanban ↔ Lista** com tabela linha-a-linha (lote, hotel, status, oferta atual, deadline, owner).
- **Seleção → Diretório de Hotéis**: alterar label no Sidebar, header da página, `<title>` e breadcrumbs. Manter rota `/selecao` por enquanto (evita quebrar links salvos).
- **Hidratação por cliente**: cada página lê `useClientsStore().selectedClientId` e consulta apenas dados desse tenant (RLS já filtra, mas a query usa `eq client_tenant_id` para performance e clareza).

## Detalhes técnicos relevantes

- RLS já tem `can_see_tenant(auth.uid(), client_tenant_id)`. Reutilizar.
- Seeder roda via `createServerFn` com `requireSupabaseAuth` (não admin) → respeita RLS, só semeia tenant que o usuário pode ver.
- Hotéis vêm de `hotels` (tabela existente). Seeder filtra hotéis ativos por cidade.
- Demo year coverage: 2024 (baseline), 2025 (current), 2026 (forecast/plan).
- Tudo determinístico por `mulberry32(hash(tenant_id))` para idempotência.

## Decisões que preciso confirmar

1. **Escopo de execução**: posso entregar tudo em sequência (fases 1→4) num único ciclo longo, ou prefere por módulo (ex: começar por Diagnóstico+Decision Center, validar, depois Estratégia, etc.)?
2. **Disparo do seed**: botão no painel Admin → "Carregar demo neste cliente" (mais controle), ou seed automático na primeira vez que o cliente é criado?
3. **Diretório de Hotéis**: manter URL `/selecao` ou renomear para `/diretorio` (quebra links salvos)?
4. **Leilão reverso**: ocultar da nav apenas, ou remover de vez o componente?

Confirme essas 4 decisões e eu sigo direto pela Fase 1 (migration).
