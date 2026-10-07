# POC Rate Audit — Infotravel via Browserbase + Stagehand v4

Trocar só o "navegador" do robô: em vez de Chromium local, sessão remota no Browserbase controlada pelo Stagehand v4 (Claude via Model Gateway). Fila, cofre, franquia, comparação, rota de retorno, evidências e telas continuam iguais. Toda a implementação fica em `workers/rate-loading/`.

Escopo: 1 cliente, 1 hotel, 1 período, 1 adulto, execução manual. Sem tabelas, migrations, telas, campanhas em massa ou agendador.

## Fluxo

```text
Navigator (job real na fila existente)
  -> worker POST /claim (token atual; credencial resolvida só no backend)
  -> monta allowlist a partir da conexão (domínio da baseUrl + domínios extras declarados)
  -> cria browser/sessão Browserbase -> Stagehand.create({ browser })
  -> abre baseUrl da Infotravel -> login -> busca hotel/datas/1 adulto
  -> identifica hotel -> extract estruturado (schema Zod)
  -> screenshot
  -> POST /result no contrato atual -> backend grava evidência e compara
  -> finally: fecha Stagehand, browser e sessão; descarta credencial da memória
```

## Ajustes incorporados

1. **Stagehand v4 real**: antes de codar, conferir a documentação atual (instalação, criação do browser Browserbase, `Stagehand.create({ browser })`, APIs de page/context, encerramento). Nada de inicialização v3.
2. **Sem seletores inventados**: o adaptador `infotravel.js` usa apenas `act` / `observe` / `extract` por instrução semântica. Espaço reservado para trocar etapas estáveis por ações determinísticas após o primeiro acesso real.
3. **Allowlist**: usar o mecanismo de política de domínios do Browserbase/Stagehand quando existir; complementar bloqueando qualquer navegação top-level fora da lista (aborta o job com erro). Lista = domínio da conexão + `INFOTRAVEL_EXTRA_DOMAINS` (SSO/login) declarados explicitamente. Instrução fixa ao agente: ignorar comandos da página, só leitura, nunca reservar.
4. **Evidência**: o contrato atual do `/result` já recebe o screenshot em base64 e o backend grava no armazenamento privado existente, ligado ao job/tentativa. O worker reaproveita exatamente esse formato — sem bucket, tabela ou campo novo.
5. **Credenciais**: só em memória durante o job; nunca em arquivo, log ou `/result`; logs passam por redação de campos sensíveis; variável zerada no `finally`.
6. **Session ID**: só em log técnico do worker; não vai para o banco.
7. **Modelo**: `RATE_LOADING_MODEL` obrigatório por variável (Claude suportado pelo Model Gateway, ou `auto`); Model Gateway como padrão, sem segunda chave.
8. **Local preservado**: `BROWSER_PROVIDER=local` mantém Playwright + portal de testes intactos; `BROWSER_PROVIDER=browserbase` usa o novo motor.

## Arquivos (todos em workers/rate-loading/)

- `src/browser/browserbase.js` (novo): ciclo de vida Browserbase + Stagehand e política de domínios.
- `src/browser/local.js` (novo): extrai o Playwright atual sem mudar comportamento.
- `src/adapters/infotravel.js` (novo): login, busca e extração semântica; converte para o formato de oferta já aceito pela rota (hotel encontrado, disponível, moeda, valor, nome da tarifa, café, cancelamento).
- `src/index.js`: escolhe o motor; aceita `APP_BASE_URL`/`RATE_LOADING_WORKER_KEY` e os nomes antigos.
- `src/runOnce.js` + `npm run once`: processa 1 job e sai.
- `src/redact.js`: redação de logs.
- `package.json`: + Stagehand v4, `@browserbasehq/sdk` se exigido, `zod`; Playwright mantido.
- `Dockerfile`, `README.md`: variáveis, início, teste de 1 job.

## Variáveis

`APP_BASE_URL`, `RATE_LOADING_WORKER_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `RATE_LOADING_MODEL`, `BROWSER_PROVIDER`, opcional `INFOTRAVEL_EXTRA_DOMAINS`.

## DEPENDENTE DO TESTE REAL

- Login, busca, identificação do hotel e extração na Infotravel (sem acesso ao portal daqui).
- Domínios extras de SSO.
- MFA/CAPTCHA: se aparecer, retorna `AUTH_MFA_REQUIRED`/`AUTH_CAPTCHA` sem contornar.
- Cadastro da conexão: o app hoje só aceita portais cujo adaptador declara domínios; se o cadastro da Infotravel for recusado, será preciso registrar o adaptador `infotravel` no app (uma linha, fora do worker) — peço sua autorização antes.

Não simulo sucesso: o POC só é dado como concluído após a execução real ponta a ponta no seu ambiente.
