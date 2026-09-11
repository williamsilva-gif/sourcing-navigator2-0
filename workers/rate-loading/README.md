# Rate Loading worker

Headless browser worker for the Rate Loading Check feature. It runs **outside**
the Lovable app runtime, because the app runs on an edge runtime with no
Chromium available.

## Run locally against the mock portal

```bash
cd workers/rate-loading
npm install
npx playwright install chromium

# terminal 1 — fake OBT portal
npm run mock-portal            # http://127.0.0.1:4599 (demo@navigator.test / demo1234)

# terminal 2 — worker
NAVIGATOR_API_BASE=https://project--<project-id>-dev.lovable.app \
RATE_LOADING_WORKER_TOKEN=<token from app secrets> \
npm run worker
```

In the app, create a portal connection with adapter `mock` and base URL
`http://127.0.0.1:4599`, store the mock credentials, then launch a campaign.

## Mock portal scenarios

| Hotel name contains | Behaviour |
| --- | --- |
| `hotel exato` | exact match |
| `hotel tolerancia` | rate 2.00 above the agreement (inside tolerance) |
| `hotel caro` | rate well above the agreement |
| `hotel sem cafe` | breakfast missing |
| `hotel nlra` | NLRA instead of LRA |
| `hotel moeda` | wrong currency |
| `hotel sem tarifa` | corporate rate not loaded |
| anything else | hotel not found |

## Deploy

Build the image and run it anywhere that allows outbound HTTPS
(Fly.io, Render, Cloud Run, an EC2 instance, an internal VM):

```bash
docker build -t navigator-rate-loading-worker .
docker run -e NAVIGATOR_API_BASE=... -e RATE_LOADING_WORKER_TOKEN=... navigator-rate-loading-worker
```

Scale by running more containers; job claiming uses `FOR UPDATE SKIP LOCKED`
with leases, so concurrent workers never process the same check twice.
