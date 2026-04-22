

## Diagnóstico

O erro **"Maximum update depth exceeded"** vem de **selectors do Zustand que retornam objetos novos a cada chamada** — não de `useEffect` quebrado. Seu prompt original mira no alvo errado. Eis o que realmente está acontecendo:

### Causa raiz

`RecommendedActionsModal.tsx` linha 52:
```ts
const executedActionIds = useActionStore((s) =>
  new Set(s.actions.map((a) => `${a.opportunityId}::${a.label}`))
);
```

Zustand compara o resultado do selector por referência (`Object.is`). `new Set(...)` cria um Set diferente a cada execução → Zustand acha que mudou → força re-render → selector roda de novo → novo Set → loop infinito. O erro literal *"The result of getServerSnapshot should be cached to avoid an infinite loop"* confirma exatamente isso.

`OpportunitiesList.tsx` linha 22 tem o mesmo padrão (`new Set(executedActions.filter(...))`) mas dentro do corpo do componente após o selector — não dispara o loop, mas é trabalho desperdiçado.

## Correções

### 1. `RecommendedActionsModal.tsx` — fix do loop

Selecionar **apenas o array primitivo** do store, derivar o Set com `useMemo`:

```ts
const executeAction = useActionStore((s) => s.executeAction);
const actions = useActionStore((s) => s.actions);

const executedActionIds = useMemo(
  () => new Set(actions.map((a) => `${a.opportunityId}::${a.label}`)),
  [actions]
);
```

### 2. `OpportunitiesList.tsx` — mesma higiene

Trocar a derivação inline por `useMemo`:

```ts
const inExecutionByOpp = useMemo(
  () => new Set(
    executedActions.filter((a) => a.status !== "completed").map((a) => a.opportunityId)
  ),
  [executedActions]
);
```

### 3. `CriticalAlerts.tsx` — memoizar sort

`[...alerts].sort(...)` roda a cada render. Trocar por:

```ts
const sorted = useMemo(() => {
  const order = { high: 0, medium: 1, low: 2 } as const;
  return [...alerts].sort((a, b) => order[a.severity] - order[b.severity]);
}, [alerts]);
```

### 4. `routes/index.tsx` — eliminar warning de exhaustive-deps

O `useEffect([])` que chama `evaluate()` está correto na intenção, mas posso melhorar usando ref para garantir execução única sem suprimir lint:

```ts
const didInit = useRef(false);
useEffect(() => {
  if (!didInit.current && !current) {
    didInit.current = true;
    evaluate();
  }
}, [current, evaluate]);
```

## O que NÃO vou aplicar do seu prompt

- ❌ "Comparar previous vs new antes de setState" — não há `setState` problemático.
- ❌ "Avoid dynamic objects in dependency arrays" — os arrays nas dependências (`[bookings, capOverrides, useDemo]` em `useDecisionData`) já são referências estáveis vindas do Zustand. Não é a causa.
- ❌ "Limit recalculation triggers / batch updates" — não há recálculo em loop; o problema é estrutural no selector.

Aplicar essas mitigações em código que não tem o problema só polui a base. O fix real são as 3 trocas de selector inline → `useMemo` listadas acima.

## Arquivos editados

- `src/components/dashboard/RecommendedActionsModal.tsx` — selector + useMemo
- `src/components/dashboard/OpportunitiesList.tsx` — useMemo no Set derivado
- `src/components/dashboard/CriticalAlerts.tsx` — useMemo no sort
- `src/routes/index.tsx` — useRef para init de evaluate

## Por que não quebra nada

- Tipos e API pública dos componentes inalterados.
- Comportamento idêntico — apenas estabiliza referências.
- Sem mudanças em store, engine, ou rotas.

