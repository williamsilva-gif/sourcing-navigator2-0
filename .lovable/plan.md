# Reset completo + remoção da migração

Confirmei seu admin no banco: **William Silva (william.silva@travelacademy.com.br)** com role `ta_master`. Hoje o banco tem 15.034 hotéis, 500 bookings, 5 tenants e 0 RFPs.

## 1. Zerar o banco (mantendo só você)

Apago **todos os dados** das tabelas, preservando apenas:
- Seu usuário em `auth.users` (intocado)
- Seu `profiles` (William Silva)
- Seu `user_roles` como `ta_master`
- O tenant TA (Travel Academy) ao qual você pertence

Vou apagar nesta ordem (respeitando dependências):
- `rfp_responses`, `rfp_invitations`, `rfps`
- `bookings`
- `billing_events`
- `hotel_members`, `hotels` (todos os 15.034)
- `tenant_modules`, `tenant_thresholds`
- `profiles` (exceto o seu)
- `user_roles` (exceto o seu)
- `tenants` (exceto o tenant TA)

Resultado: app como se fosse o primeiro uso, com apenas você logado como Admin Master.

## 2. Remover a migração para o banco

Apago tudo que envolve "migrar dados locais para o banco":
- Botão/banner "Migrar para o banco" em `src/routes/hoteis.tsx`
- `bulkUpsertHotelsByCodeFn` em `src/lib/hotels.functions.ts` e chamadas
- Stores locais que duplicavam o banco: `baselineStore`, `clientsStore`, `snapshotStore`, dados demo em `decisionData.ts`
- Limpeza de `localStorage` no boot para remover restos de demo/baseline antigos do seu navegador

Mantenho o **upload de planilha de hotéis** (CSV/XLSX) em `/hoteis`, mas direto para o banco — sem etapa de "local primeiro, depois migrar". É essa via que você vai usar para subir hotéis daqui para frente.

## 3. Quantos hotéis por lote no upload?

Recomendo **1.000 por lote**, não 5.000. Motivos práticos:
- Cada `upsert` no Supabase via PostgREST tem limite seguro em torno de 1.000–2.000 linhas por requisição antes de começar a dar timeout/erro de payload.
- Com 1.000/lote e 15.000 hotéis = 15 requisições, ~30–60s no total, com barra de progresso e retry por lote.
- Se um lote falhar, você reenvia só aquele, não os 5.000.
- 5.000/lote tende a estourar timeout do worker (que foi exatamente o sintoma do "Unauthorized / falharam" anterior — a função demorava demais e perdia a sessão).

Implementação: o uploader divide automaticamente o arquivo em lotes de 1.000, mostra progresso "lote 3 de 15", e qualquer lote que falhar fica marcado para reenvio individual.

## 4. Detalhes técnicos

- Uso `supabase--insert` com `DELETE` em massa preservando seu `user_id` e tenant TA.
- Removo arquivos `baselineStore.ts`, `snapshotStore.ts` e dados demo embutidos; ajusto telas de Estratégia/Diagnóstico/Dashboard para lerem do banco (vazio = "nenhum dado ainda, importe hotéis para começar").
- O upload de hotéis passa a chamar uma server function única `uploadHotelsBatchFn({ rows })` com Zod validando até 1.000 linhas, gated por `useAuthReady` (corrige o `Unauthorized` definitivamente).
- `src/routes/index.tsx`, `Header.tsx` continuam com a correção de role/ready do Stage 1 anterior.

## 5. Ordem de execução

1. Migration de DELETE (você aprova).
2. Remover código de migração + stores locais + demos.
3. Trocar uploader de hotéis para chamada direta em lotes de 1.000.
4. Você loga, vê app vazio, sobe a planilha, e os hotéis aparecem.

Posso prosseguir?
