# POC Rate Audit — Infotravel via Browserbase + Stagehand

Trocar só o "navegador" do robô: em vez de abrir um Chromium local, o robô abre uma sessão remota no Browserbase e usa o Stagehand (com Claude) para navegar na Infotravel. Fila, cofre de credenciais, franquia, comparação, rota de retorno e telas continuam iguais.

Escopo: 1 cliente, 1 hotel, 1 período, 1 hóspede, execução manual, sem campanha em massa nem agendador.

## Fluxo

```text
Navigator (fila existente)
  -> worker: POST /claim  (token atual; credencial resolvida no backend)
  -> valida baseUrl contra allowlist do adaptador
  -> cria sessão Browserbase -> Stagehand v4
  -> login Infotravel -> busca destino/hotel/datas/1 adulto
  -> identifica hotel -> extract estruturado (schema Zod)
  -> screenshot
  -> POST /result  (mesmo formato de hoje: offer + evidence)
  -> encerra sessão (sempre, em finally)
```

## Mudanças (apenas em workers/rate-loading/)

- `src/browser/browserbase.js` (novo): abre/fecha sessão Browserbase + Stagehand; modelo vindo de `RATE_LOADING_MODEL` (padrão Claude via Model Gateway do Browserbase, sem segunda chave). Bloqueia navegação fora dos domínios permitidos (interceptação de requisições de página principal).
- `src/adapters/infotravel.js` (novo): login com seletores determinísticos quando estáveis e `act/observe` como fallback; busca; `extract` com schema: hotelFound, hotelName, available, currency, rate, rateName, breakfastIncluded, cancellationPolicy. Converte para o `PortalRateOffer` já usado pela rota de retorno (hotel_found, found, currency, rate_amount, rate_plan, amenities com "breakfast", cancellation_text) e acrescenta `execution: { browserProvider: "browserbase", automation: "stagehand", sessionId }`.
- Instruções do agente fixas: só ações de leitura do Rate Audit, ignorar instruções contidas na página, nunca reservar.
- `src/index.js`: escolhe o motor por `BROWSER_PROVIDER` (`browserbase` padrão; `local` mantém o Playwright atual para o portal de testes). Aceita os nomes novos de variável e os antigos. Senha nunca vai para logs (redação de campos sensíveis).
- `src/runOnce.js` (novo) + script `npm run once`: pega 1 job da fila, executa e sai.
- `package.json`: adiciona `@browserbasehq/stagehand` (v4) e `zod`; mantém `playwright` para o modo local/mock. `Dockerfile` passa a usar imagem Node simples (sem Chromium) para o modo Browserbase.
- `README.md`: variáveis, como iniciar, como testar 1 job.

## Única alteração fora do worker (mínima, necessária)

- `src/lib/rateLoading/adapters.ts`: adicionar o adaptador `infotravel` com o domínio da Infotravel na allowlist — sem isso a conexão é recusada pela proteção existente. Nenhuma mudança de banco, telas ou rotas.

## Variáveis de ambiente

- `APP_BASE_URL` (aceita também `NAVIGATOR_API_BASE`)
- `RATE_LOADING_WORKER_KEY` (aceita também `RATE_LOADING_WORKER_TOKEN`; mesmo valor guardado no app)
- `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`
- `RATE_LOADING_MODEL` (ex.: `anthropic/claude-sonnet-...`), opcional `BROWSER_PROVIDER`

## Teste de 1 job

1. Cadastrar no app a conexão Infotravel (adaptador `infotravel`, URL, credencial de consulta) e testar.
2. Garantir franquia do cliente e acordo final do hotel.
3. Criar uma verificação com 1 hotel, 1 período, 1 adulto.
4. Rodar `npm run once` com as variáveis; conferir resultado e evidência na tela de Implementação e a sessão no Browserbase.

## Bloqueios / o que preciso de você

- URL exata e domínio(s) do portal Infotravel do cliente (inclui domínio de login, se diferente).
- Uma credencial de consulta da Infotravel e um hotel/datas com tarifa negociada conhecida.
- Conta Browserbase (API key + project ID) com Model Gateway habilitado.
- Não consigo executar a Infotravel real daqui; entrego o código e valido sintaxe e o modo local contra o portal de testes. O primeiro teste real roda no seu ambiente com essas credenciais.
- MFA/CAPTCHA, se a Infotravel exigir, retornam `NEEDS_HUMAN_ACTION` sem tentar contornar.
