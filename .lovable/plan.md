# Plano: Fechar os 4 gaps de "Production Reality"

Ordem de execução escolhida por impacto e dependência: **Storage → Observabilidade → DR → Rate Limiting**.

---

## Fase 1 — Storage de arquivos originais

**Problema:** hoje `baseline_uploads` guarda apenas metadados (filename, contagem de linhas). O arquivo `.xlsx`/`.csv` original some após o parse. Sem ele, não há auditoria, reprocessamento ou prova de origem dos dados de bookings/contratos.

**Entregáveis:**
- Bucket privado `baseline-files` (Supabase Storage) com RLS escopado por `client_tenant_id` no path (`{tenant_id}/{upload_id}/{filename}`).
- Coluna `storage_path` em `baseline_uploads`.
- Upload do arquivo bruto **antes** do parse no `DataIngestionPanel`; se o parse falhar, o arquivo fica disponível para reprocessar.
- Botão "Baixar arquivo original" e "Reprocessar" na lista de uploads (módulo Diagnóstico).
- Política: TA master + tenants visíveis podem ler/baixar; só TA master apaga.

**Bonus mesmo escopo:** anexar PDFs de contrato em `baseline_contracts` (mesmo bucket, prefixo `contracts/`).

---

## Fase 2 — Observabilidade (Error Tracking & Logs)

**Problema:** erros no cliente somem (sem Sentry); erros no server-fn só aparecem se alguém olhar os logs do Worker manualmente. Sem alertas.

**Entregáveis:**
- **Sentry** no frontend (`@sentry/react`) + source maps no build, capturando erros não tratados, rejeições de promise e breadcrumbs de navegação.
- Wrapper de erro em todos os `createServerFn` (helper `withErrorReporting`) que envia exceções para Sentry com `userId`, `tenantId`, nome da função.
- Tag automática de `release` (commit SHA) e `environment` (preview vs published).
- Painel de health interno em `/admin/health`: últimos 50 erros, taxa de erro por server-fn (lendo logs do Worker), status do DB.
- Alerta Sentry → e-mail/Slack para erros novos em produção.

**Secrets necessários:** `SENTRY_DSN` (público) e `SENTRY_AUTH_TOKEN` (upload de source maps no build).

---

## Fase 3 — Availability & Recovery (DR)

**Problema:** backup automático do Postgres existe (Lovable Cloud), mas nunca foi testado um restore; sem health check externo; sem runbook.

**Entregáveis:**
- **Health check endpoint** público `/api/public/health` retornando `{db: ok, auth: ok, version, timestamp}` (ping leve no Postgres + checagem de auth).
- Monitor externo (UptimeRobot ou BetterStack — gratuito) batendo a cada 5 min na produção e na URL custom.
- **Job semanal de backup lógico** (server route protegido por secret) exportando `bookings`, `client_actions`, `rfps`, `baseline_contracts` para o bucket `baseline-files/backups/{YYYY-MM-DD}/`.
- **Runbook** em `docs/RUNBOOK.md`: como restaurar backup, como reverter migration, contatos, RTO/RPO declarados.
- Teste de restore documentado (uma vez): clonar dados num tenant de teste e validar.

---

## Fase 4 — Rate Limiting

**Problema:** plataforma Lovable Cloud não oferece primitivas nativas. Hoje qualquer endpoint público (`/api/public/*`, login) aceita requests ilimitados → vetor de abuso.

**Entregáveis (ad-hoc, escopo mínimo):**
- Tabela `rate_limit_buckets` (key TEXT, window_start TIMESTAMPTZ, count INT) com índice e TTL via cron.
- Middleware `rateLimit({ key, max, windowSec })` para `createServerFn` e server routes.
- Aplicar em: login (5 tentativas / 15 min / IP), criação de RFP (10 / hora / tenant), endpoints `/api/public/*` de resposta de hotel (20 / min / invitation).
- Resposta `429` padronizada com `Retry-After`.
- Documentar que isso é solução interina até a plataforma oferecer rate limit gerenciado.

---

## Resumo de impacto

| Fase | Esforço | Quebra UX? | Bloqueia produção? |
|---|---|---|---|
| 1 Storage | Médio | Não | Sim — perda de dado real |
| 2 Observabilidade | Médio | Não | Sim — voando às cegas |
| 3 DR | Pequeno | Não | Risco alto se houver corrupção |
| 4 Rate Limit | Pequeno-Médio | Não | Risco médio de abuso |

## Detalhes técnicos

- Storage RLS: `(storage.foldername(name))[1]::uuid IN (SELECT visible_tenant_ids(auth.uid()))`.
- Sentry: inicializado em `src/router.tsx` (cliente) e em wrapper de `createServerFn` (server, via `Sentry.captureException`).
- Health check: server route `/api/public/health.ts` com `select 1` via `supabaseAdmin`.
- Rate limit: incremento atômico via RPC `pg` function `rl_increment(key, window_sec)` retornando count, evitando race condition.

## Fora de escopo (deixar para depois)

- Caching server-side (Redis/KV) — só vale quando houver query lenta medida.
- CI/CD com staging separado — o fluxo preview/published do Lovable cobre o essencial hoje.
- WAF avançado — depende de evolução da plataforma.

---

**Posso começar pela Fase 1 (Storage) assim que você aprovar.** Se preferir mudar a ordem ou tirar alguma fase, é só dizer.