// Navigator Rate Loading worker (orchestrator).
// Claims a job from the existing queue, runs the selected browser engine
// read-only against the portal and posts observations to the existing /result
// endpoint. It NEVER decides pass/fail — the backend comparator does.
//
// BROWSER_PROVIDER=browserbase (default) -> Browserbase + Stagehand v4
// BROWSER_PROVIDER=local                 -> local Playwright (mock portal / regression)
import { log, scrub } from "./redact.js";

const API_BASE = (process.env.APP_BASE_URL ?? process.env.NAVIGATOR_API_BASE ?? "").replace(/\/$/, "");
const TOKEN = process.env.RATE_LOADING_WORKER_KEY ?? process.env.RATE_LOADING_WORKER_TOKEN ?? "";
const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const PROVIDER = (process.env.BROWSER_PROVIDER ?? "browserbase").toLowerCase();

async function loadEngine() {
  if (PROVIDER === "local") return import("./browser/local.js");
  if (PROVIDER === "browserbase") return import("./browser/browserbase.js");
  throw new Error(`unknown BROWSER_PROVIDER: ${PROVIDER}`);
}

async function api(path, body) {
  const res = await fetch(`${API_BASE}/api/public/rate-loading/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-token": TOKEN },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function classify(err) {
  if (err?.code === "DOMAIN_NOT_ALLOWED") return "PORTAL_LAYOUT_CHANGED";
  if (err?.code) return err.code;
  const m = String(err?.message ?? "").toLowerCase();
  if (m.includes("timeout")) return "PORTAL_TIMEOUT";
  if (m.includes("net::") || m.includes("econnrefused")) return "PORTAL_UNAVAILABLE";
  if (m.includes("selector") || m.includes("locator")) return "PORTAL_LAYOUT_CHANGED";
  if (m.includes("crash")) return "WORKER_BROWSER_CRASH";
  return "UNKNOWN_ERROR";
}

export async function runJob(engine, payload) {
  const { job, connection, check } = payload;
  const started = Date.now();
  const secrets = [connection.credential?.password, connection.credential?.username];

  if (!connection.credential) {
    return api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      errorCode: "AUTH_ACCESS_DENIED",
      errorMessage: "no credential configured",
      durationMs: Date.now() - started,
    });
  }

  try {
    const r = await engine.execute({ connection, check });
    const errorCode = !r.offer.hotel_found ? "HOTEL_NOT_FOUND" : !r.offer.found ? "RATE_NOT_FOUND" : null;
    log.info("job done", { jobId: job.id, engine: engine.name, execution: r.execution, errorCode });
    return await api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      correlationId: job.idempotencyKey,
      loginStatus: "success",
      searchStatus: r.offer.found ? "success" : "not_found",
      offer: r.offer.found ? r.offer : null,
      errorCode,
      pageUrl: r.pageUrl,
      durationMs: Date.now() - started,
      evidence: r.evidence,
    });
  } catch (err) {
    const code = classify(err);
    const message = scrub(String(err?.message ?? err), secrets).slice(0, 300);
    log.error("job failed", { jobId: job.id, engine: engine.name, code, message });
    return api("result", {
      jobId: job.id,
      workerId: WORKER_ID,
      correlationId: job.idempotencyKey,
      loginStatus: code.startsWith("AUTH_") ? "failed" : "success",
      searchStatus: "error",
      errorCode: code,
      errorMessage: message,
      pageUrl: err?.pageUrl ?? null,
      durationMs: Date.now() - started,
      evidence: err?.evidence ?? [],
    });
  } finally {
    // Drop the credential reference as soon as the job ends.
    if (connection.credential) {
      connection.credential.password = "";
      connection.credential = null;
    }
  }
}

function assertConfig() {
  if (!API_BASE || !TOKEN) {
    console.error("APP_BASE_URL and RATE_LOADING_WORKER_KEY are required");
    process.exit(1);
  }
}

export async function runOnce() {
  assertConfig();
  const engine = await loadEngine();
  try {
    const payload = await api("claim", { workerId: WORKER_ID, leaseSeconds: 600 });
    if (!payload?.job) {
      log.info("no job in queue");
      return null;
    }
    log.info("claimed job", { jobId: payload.job.id, adapter: payload.connection?.adapterKey });
    return await runJob(engine, payload);
  } finally {
    await engine.shutdown();
  }
}

async function loop() {
  assertConfig();
  const engine = await loadEngine();
  log.info(`Rate Loading worker ${WORKER_ID} (${PROVIDER}) polling ${API_BASE}`);
  let stopping = false;
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));
  // POC: one job at a time, no mass processing.
  while (!stopping) {
    try {
      const payload = await api("claim", { workerId: WORKER_ID, leaseSeconds: 600 });
      if (!payload?.job) await new Promise((r) => setTimeout(r, POLL_MS));
      else await runJob(engine, payload);
    } catch (err) {
      log.error("poll error", { message: String(err?.message ?? err).slice(0, 200) });
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  await engine.shutdown();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loop().catch((e) => {
    log.error("fatal", { message: String(e?.message ?? e) });
    process.exit(1);
  });
}
