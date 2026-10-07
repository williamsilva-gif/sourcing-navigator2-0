# Rate Loading worker

Orchestrator between the Navigator queue and a browser engine. It claims a job
(`/api/public/rate-loading/claim`), drives the portal read-only, and posts
observations + screenshot to the existing `/api/public/rate-loading/result`
(which stores the evidence in the existing private bucket and runs the comparator).

## Engines

| `BROWSER_PROVIDER` | Engine | Adapters |
| --- | --- | --- |
| `browserbase` (default) | Browserbase session + Stagehand v4 | `infotravel` |
| `local` | local Playwright (unchanged) | `mock` |

## Environment

| Var | Required | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | yes | e.g. `https://project--<id>.lovable.app` (alias: `NAVIGATOR_API_BASE`) |
| `RATE_LOADING_WORKER_KEY` | yes | same value as the app secret `RATE_LOADING_WORKER_TOKEN` (alias accepted) |
| `BROWSERBASE_API_KEY` | browserbase | resolves the project automatically |
| `RATE_LOADING_MODEL` | no | Claude id supported by the Browserbase Model Gateway, or `auto` (default) |
| `INFOTRAVEL_EXTRA_DOMAINS` | no | comma-separated SSO/login domains beyond the connection host |
| `BROWSER_PROVIDER` | no | `browserbase` / `local` |

Allowed domains = host of the connection base URL + `INFOTRAVEL_EXTRA_DOMAINS`.
Enforced by Stagehand's native `context.setDomainPolicy` and re-checked after every step;
any top-level navigation outside the list aborts the job.

## Run

```bash
cd workers/rate-loading
npm install
npm run once     # claim exactly 1 job, process it, exit
npm run worker   # continuous polling, 1 job at a time
```

## Regression with the mock portal

```bash
npm install playwright && npx playwright install chromium
npm run mock-portal                       # http://127.0.0.1:4599
BROWSER_PROVIDER=local APP_BASE_URL=... RATE_LOADING_WORKER_KEY=... npm run worker
```

## Infotravel adapter status (POC)

No selectors are hard-coded: login, search and extraction use Stagehand semantic
`act` / `extract`. Credentials are passed as Stagehand `variables`, never as prompt
text, never logged, never written to disk, dropped at the end of the job.
Steps marked **DEPENDENT ON REAL TEST**: login, search form, hotel identification,
extraction quality, extra SSO domains, MFA/CAPTCHA (returned as `AUTH_MFA_REQUIRED` /
`AUTH_CAPTCHA`, never bypassed).
