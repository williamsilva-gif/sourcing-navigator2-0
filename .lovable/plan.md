# Plano: Fechar os 4 gaps de "Production Reality"

Ordem de execução escolhida por impacto e dependência: **Storage → ~~Observabilidade~~ → DR → Rate Limiting**.

- Fase 1 (Storage) — **CONCLUÍDA**
- Fase 2 (Observabilidade) — **PULADA** (voltaremos depois)
- Fase 3 (DR) — **CONCLUÍDA**
- Fase 4 (Rate Limiting) — **CONCLUÍDA**

---

## Fase 1 — Storage de arquivos originais (CONCLUÍDA)

- Bucket privado `baseline-files` com RLS por tenant
- Coluna `storage_path` em `baseline_uploads`
- Upload antes do parse + botão de download

---

## Fase 2 — Observabilidade (PULADA)

Voltaremos a esta fase futuramente. Requer SENTRY_DSN e SENTRY_AUTH_TOKEN.

---

## Fase 3 — Availability & Recovery (DR) (EM ANDAMENTO)

**Problema:** backup automático do Postgres existe (Lovable Cloud), mas nunca foi testado um restore; sem health check externo; sem runbook.

**Entregáveis:**
- **Health check endpoint** público `/api/public/health` retornando `{db: ok, auth: ok, version, timestamp}` (ping leve no Postgres + checagem de auth).
- Monitor externo (UptimeRobot ou BetterStack — gratuito) batendo a cada 5 min na produção e na URL custom.
- **Job semanal de backup lógico** (server route protegido por secret) exportando `bookings`, `client_actions`, `rfps`, `baseline_contracts` para o bucket `baseline-files/backups/{YYYY-MM-DD}/`.
- **Runbook** em `docs/RUNBOOK.md`: como restaurar backup, como reverter migration, contatos, RTO/RPO declarados.
- Teste de restore documentado (uma vez): clonar dados num tenant de teste e validar.

---

## Fase 4 — Rate Limiting (CONCLUÍDA)

- Tabela `rate_limit_buckets` + função `check_rate_limit(_key, _max, _window_seconds)` (SECURITY DEFINER, EXECUTE só para service_role).
- Cleanup `cleanup_rate_limit_buckets()` rodando a cada 15 min via `pg_cron`.
- Helper `enforceRateLimit({ bucket, key, max, windowSeconds })` em `src/lib/rate-limit.server.ts` (fail-open em erro interno).
- Aplicado em:
  - `createRfpFn`: 10 / hora / (tenant + user).
  - `getInvitationByTokenFn`: 60 / min / (token + IP).
  - `submitInvitationResponseFn`: 20 / min / (token + IP).
- Login não foi tocado (Supabase Auth já aplica rate limit nativo no endpoint `/auth/v1/token`).

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
