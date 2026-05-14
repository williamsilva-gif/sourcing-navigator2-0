# Plano: rodar fluxo end-to-end com Acme/Kontik + corrigir comparações temporais

## Objetivo
Validar o pipeline ponta-a-ponta com um cliente fictício realista (Acme abaixo da Kontik Viagens) e corrigir o bug em que o Decision Center "compara contra nada" — números fantasma de período anterior em datasets que só têm um ano.

---

## Etapa 1 — Hierarquia Kontik → Acme (seed limpo)

1. Criar tenant **Kontik Viagens** (type=`TMC`).
2. Criar tenant **Acme Travel Corp** (type=`CORP`, `parent_tenant_id` = Kontik).
3. Limpar quaisquer bookings/RFPs/hotéis órfãos vinculados a um Acme antigo.
4. Botão **"Carregar dados demo Acme"** em `/ta/clients` continua disparando os 500 bookings sintéticos do `generateDemoBookings()` — agora com Kontik visível como pai na coluna "via" da listagem.
5. Verificação: logar como `ta_master`, abrir Diagnóstico e Decision Center filtrando por Acme — devem aparecer alertas/oportunidades reais.

> Eu **não** crio usuários TMC/CORP de mentira; você usa seu Admin Master para testar o "ver como Kontik/Acme". Quando quiser convidar pessoas reais para Kontik, usamos o fluxo de promoção por email já existente.

---

## Etapa 2 — Seletor de período + comparação automática

### UX
Adicionar um **PeriodSelector** no topo do Decision Center (e reutilizável em Diagnóstico):

- **Granularidade**: Ano · Trimestre · Mês · Intervalo customizado
- **Período atual**: dropdown contextual à granularidade
- **Comparação**: período imediatamente anterior do mesmo tamanho, **automático**
- Estado persistido em **search params** (`?period=2025&grain=year`) para ser linkável e sobreviver a refresh

### Regras de cálculo
- KPIs do "atual" filtram bookings por `checkin` dentro da janela.
- Deltas (`vs período anterior`) usam a janela imediatamente anterior do mesmo tamanho.
- Se a janela anterior **não tem dados**, o componente exibe `—` (em vez de `0%` ou `▼ 100%`) e um tooltip "Sem histórico para comparar".
- Mesma regra propaga para `recommendationEngine` (leakage, concentração, ADR vs cap) — só comparam se as duas janelas têm bookings.

### Default ao abrir
- Se houver dados: granularidade = **Ano**, período atual = ano com mais bookings recentes.
- Se vazio: estado "sem baseline" como já existe.

---

## Etapa 3 — Validação manual do fluxo completo (checklist)

Com Acme seedado e período = 2025:

1. **Diagnóstico** — histograma ADR, heatmap de cidades, painel de ingestão.
2. **Estratégia** — caps por cidade, tiering, regras de negócio.
3. **RFP** — criar 1 RFP, anexar 2-3 hotéis, mandar convites.
4. **Negociação** — abrir lote, leilão reverso simulado.
5. **Análise** — comparar respostas.
6. **Seleção** — premiar primary/backup.
7. **Implementação / Monitoramento** — confirmar que a oportunidade vira ação executada e some do Decision Center.

Cada passo bloqueante vira um bug ticket separado, não tentamos consertar tudo em uma só rodada.

---

## Etapa 4 (futura, fora deste plano) — Cliente real
Depois que o fluxo Acme estiver verde, repetimos com o relatório real: criamos o tenant do cliente, importamos o XLSX/CSV via painel de ingestão, e o seletor de período já estará pronto para a janela que o relatório cobrir.

---

## Detalhes técnicos

- **Migração SQL**: nenhuma nova tabela. Apenas seed via `supabase--insert` para Kontik + religar Acme.
- **Novos arquivos**:
  - `src/components/common/PeriodSelector.tsx`
  - `src/lib/periodFilter.ts` (helpers `windowFor(grain, period)` e `previousWindow(window)`)
- **Editados**:
  - `src/routes/_authenticated/ta/clients.tsx` — seed agora cria Kontik + Acme se faltarem
  - `src/lib/recommendationEngine.ts` — aceita `currentWindow` e `previousWindow` opcionais
  - `src/components/dashboard/*` (KpiCard, ImpactTracking, SavingsChart, CriticalAlerts) — consomem o seletor via search params
  - `src/routes/index.tsx` (Decision Center) e `src/routes/diagnostico.tsx` — montam o `PeriodSelector` e validam search params com `zodValidator`
- **Comparações fantasma**: substituir cálculos `delta = current - 0` por `delta = previousHasData ? current - previous : null` e renderizar `—` quando `null`.

## Fora de escopo
- Importação de CSV/XLSX real (Etapa 4).
- Comparações multi-tenant cruzadas.
- Histórico de seletores por usuário.