## Plano — Refinar "Plano para a RFP 2026"

Reestruturar o componente `src/components/dashboard/Rfp2026Plan.tsx` para virar um verdadeiro decision engine, separando ADR real, CAP negociado e CAP sugerido, e adicionando status, prioridade, justificativa, impacto operacional e ações clicáveis.

### 1. Modelo de dados (CityRecommendation)

Trocar o cálculo atual por:

```text
adr2025          = média real paga em 2025
currentCap       = média dos contract.cap vigentes em 2025 para hotéis da cidade
                   (sem fallback para ADR — se não houver contrato: null → "Sem cobertura")
suggestedCap2026 = round5(min(adr2025 * 0.95, currentCap * 1.02))
                   nunca acima de currentCap + 2% (impede "subir o teto")
gapPct           = (adr2025 - currentCap) / currentCap * 100
overCapPct       = % de room nights com adr > capForBooking
hotelsInvolved   = nº de hotéis distintos da cidade em 2025
hotelsOverCap    = nº de hotéis com pelo menos 1 reserva acima do cap
top2Share        = concentração nos 2 maiores hotéis
status           = derivado (regra abaixo)
priority         = derivada (regra abaixo)
reason           = string curta explicando o suggestedCap
estimatedSavings = leakageSpend * 0.35 (mantém)
```

### 2. Status da cidade (badge colorido)

Regra de decisão na ordem:

```text
sem contratos vigentes              → "Sem cobertura"   (cinza)
overCapPct >= 25%                   → "Leakage crítico" (destructive)
top2Share  >= 60% e hotelsInvolved>=2 → "Alta concentração" (warning)
gapPct     >= 8%                    → "Acima do cap"    (warning)
caso contrário                      → "Dentro do cap"   (success)
```

### 3. Prioridade

```text
Alta  : status ∈ {Leakage crítico} OU estimatedSavings >= 30% do total
Média : status ∈ {Acima do cap, Alta concentração}
Baixa : restante (incluindo Dentro do cap e Sem cobertura sem leakage)
```

Ordenar tabela por prioridade (Alta → Baixa) e dentro disso por `estimatedSavings` desc.

### 4. Justificativa ("Por quê?")

Subtítulo abaixo do `suggestedCap2026` (texto pequeno, muted):
- Se gap alto: `"ADR 12.4% acima do cap negociado"`
- Se leakage alto: `"38% das reservas acima do cap"`
- Se concentração: `"62% concentrado em 2 hotéis"`
- Combina até 2 razões com `·`.

### 5. Impacto operacional

Nova coluna "Impacto":
```text
{hotelsOverCap} de {hotelsInvolved} hotéis
```
Tooltip explica: "hotéis que precisam ser renegociados / total na cidade".

### 6. Ações clicáveis

Coluna "Renegociar" vira coluna "Ação" com botões (`<Button size="sm" variant="outline">`):
- **"Abrir mini-RFP"** → navega para `/rfp?city={city}&suggestedCap={cap}` (a wizard de RFP já existe em `src/components/rfp/CreateRfpWizard.tsx`; só passamos query params, sem alterar o wizard nesta fase)
- **"Negociar"** → navega para `/negociacao?city={city}` (filtro existente)
- **"+ Pipeline"** → chama `actionStore.queueAction({ kind: 'renegotiation', city, hotels: hotelsOverCap, targetCap: suggestedCap2026 })` para entrar no Action Inbox (mesma store usada pelo `recommendationEngine`)

Botão primário muda conforme status:
- Leakage crítico / Acima do cap → "Negociar" como primário
- Alta concentração → "Abrir mini-RFP" como primário
- Sem cobertura → "Abrir RFP" como primário
- Dentro do cap → só "+ Pipeline" (secundário)

### 7. Layout final da tabela

```text
| Cidade | Status | Prio | ADR 2025 | CAP atual | CAP sugerido 2026   | Leakage 2025 | Economia | Impacto       | Ação        |
|        | badge  | badge|          |           | valor + "porquê?"   |              |          | Xde Y hotéis  | botões      |
```

Header da seção mostra:
- "Economia potencial estimada: R$ X/ano"
- Contadores por status: `3 críticas · 2 acima · 1 sem cobertura · 4 dentro` (chips clicáveis para filtrar a tabela)

### 8. Detalhes técnicos

Arquivos:
- `src/components/dashboard/Rfp2026Plan.tsx` — refatorar (único arquivo de componente)
- `src/lib/rfpPlanModel.ts` — **novo**, função pura `buildCityRecommendations(bookings, contracts, year)` retornando `CityRecommendation[]`. Mantém o componente "burro" e permite testar a lógica isoladamente.
- `src/lib/actionStore.ts` — verificar se já existe `queueAction`/equivalente; se não, adicionar método mínimo para enfileirar a recomendação (sem mudar o schema atual do inbox).

Não tocar:
- `recommendationEngine.ts`, `baselineStore.ts`, `decisionData.ts`, `periodFilter.ts` — a lógica de KPIs continua igual.
- Wizard de RFP e tela de Negociação — apenas recebem query params; nada muda no comportamento delas.

### 9. Validação manual

1. `/diagnostico` → "Carregar demo 2024+2025".
2. `/` (Decision Center) → conferir tabela:
   - CAP atual ≠ ADR 2025 (vem de `contracts`).
   - Pelo menos 1 cidade "Leakage crítico" e 1 "Dentro do cap" aparecem com badges distintos.
   - Coluna "CAP sugerido" mostra valor + razão curta.
   - Coluna "Impacto" mostra `X de Y hotéis`.
   - Botões da coluna "Ação" navegam para `/rfp` e `/negociacao` com query params corretos.
3. Filtrar pelos chips de status no header reduz as linhas visíveis.
