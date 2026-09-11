// Navigator Rate Loading worker.
// Polls the app queue, drives Playwright read-only against an approved portal,
// captures evidence and posts observations back. It NEVER decides pass/fail —
// the backend runs the deterministic comparison.
import { chromium } from "playwright";
import * as mockAdapter from "./adapters/mock.js";

const API_BASE = (process.env.NAVIGATOR_API_BASE ?? "").replace(/\/$/, "");
const TOKEN = process.env.RATE_LOADING_WORKER_TOKEN ?? "";
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS ?? 30000);
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY ?? 1);

if (!API_BASE || !TOKEN) {
  console.error("NAVIGATOR_API_BASE and RATE_LOADING_WORKER_TOKEN are required");
  process.exit(1);
}

const ADAPTERS = { [mockAdapter.key]: mockAdapter };

async function api(path, body) {
  const res = await fetch(`${API_BASE}/api/public/rate-loading/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-token": TOKEN },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

function classify(err) {
  if (err?.code) return err.code;
  const m = String(err?.message ?? "").toLowerCase();
  if (m.includes("timeout")) return "PORTAL_TIMEOUT";
  if (m.includes("net::") || m.includes("econnrefused")) return "PORTAL_UNAVAILABLE";
  if (m.includes("selector") || m.includes("locator")) return "PORTAL_LAYOUT_CHANGED";
  if (m.includes("crash")) return "WORKER_BROWSER_CRASH";
  return "UNKNOWN_ERROR";
}

async function runJob(browser, payload) {
  const { job, connection, check } = payload;
  const adapter = ADAPTERS[connection.adapterKey];
  const started = Date.now();
  const evidence = [];

  if (!adapter) {
    return api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      errorCode: "UNKNOWN_ERROR",
      errorMessage: `no adapter for ${connection.adapterKey}`,
      durationMs: Date.now() - started,
    });
  }
  if (!connection.credential) {
    return api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      errorCode: "AUTH_ACCESS_DENIED",
      errorMessage: "no credential configured",
      durationMs: Date.now() - started,
    });
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(NAV_TIMEOUT);
  const page = await context.newPage();

  try {
    await adapter.login(page, connection.baseUrl, connection.credential);
    const offer = await adapter.search(page, connection.baseUrl, check);

    const shot = await page.screenshot();
    evidence.push({
      type: offer.found ? "result_screenshot" : "error_screenshot",
      contentBase64: shot.toString("base64"),
      contentType: "image/png",
      pageUrl: page.url(),
      viewport: "1440x900",
    });

    const errorCode = !offer.hotel_found ? "HOTEL_NOT_FOUND" : !offer.found ? "RATE_NOT_FOUND" : null;

    await api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      correlationId: job.idempotencyKey,
      loginStatus: "success",
      searchStatus: offer.found ? "success" : "not_found",
      offer: offer.found ? offer : null,
      errorCode,
      pageUrl: page.url(),
      durationMs: Date.now() - started,
      evidence,
    });
  } catch (err) {
    const code = classify(err);
    try {
      const shot = await page.screenshot();
      evidence.push({
        type: "error_screenshot",
        contentBase64: shot.toString("base64"),
        contentType: "image/png",
        pageUrl: page.url(),
        viewport: "1440x900",
      });
    } catch {
      /* screenshot is best effort */
    }
    await api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      correlationId: job.idempotencyKey,
      loginStatus: code.startsWith("AUTH_") ? "failed" : "success",
      searchStatus: "error",
      errorCode: code,
      errorMessage: String(err?.message ?? err).slice(0, 300),
      pageUrl: page.url(),
      durationMs: Date.now() - started,
      evidence,
    });
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log(`Rate Loading worker ${WORKER_ID} polling ${API_BASE}`);
  let stopping = false;
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));

  while (!stopping) {
    try {
      const batch = [];
      for (let i = 0; i < MAX_CONCURRENCY; i++) {
        const payload = await api("claim", { workerId: WORKER_ID, leaseSeconds: 300 });
        if (!payload?.job) break;
        batch.push(runJob(browser, payload));
      }
      if (batch.length === 0) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      } else {
        await Promise.allSettled(batch);
      }
    } catch (err) {
      console.error("poll error:", err.message);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
