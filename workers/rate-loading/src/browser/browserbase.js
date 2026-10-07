// Browserbase + Stagehand v4 engine. Used with BROWSER_PROVIDER=browserbase.
// Lifecycle: browserbase.launch() -> Stagehand.create({ browser }) -> adapter -> close all in finally.
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import * as infotravel from "../adapters/infotravel.js";
import { buildAllowlist } from "../domains.js";
import { log } from "../redact.js";

const ADAPTERS = { [infotravel.key]: infotravel };

export const name = "browserbase";

function modelConfig() {
  const m = (process.env.RATE_LOADING_MODEL ?? "").trim();
  // "auto" (or empty) => Browserbase Model Gateway selects the model; no second API key.
  if (!m || m.toLowerCase() === "auto") return undefined;
  return { modelName: m };
}

export async function execute({ connection, check }) {
  const adapter = ADAPTERS[connection.adapterKey];
  if (!adapter) {
    const err = new Error(`no browserbase adapter for ${connection.adapterKey}`);
    err.code = "UNKNOWN_ERROR";
    throw Object.assign(err, { evidence: [] });
  }
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    const err = new Error("BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID not configured");
    err.code = "UNKNOWN_ERROR";
    throw Object.assign(err, { evidence: [] });
  }

  const allowlist = buildAllowlist(connection.baseUrl, process.env[adapter.extraDomainsEnv]);
  let browser = null;
  let stagehand = null;
  const evidence = [];
  let sessionId = null;

  try {
    browser = await browserbase.launch({ apiKey, projectId });
    sessionId = browser.sessionId ?? null;
    log.info("browserbase session opened", { sessionId, allowlist });

    // Native domain policy enforced by the Stagehand runtime inside the browser.
    await browser.context.setDomainPolicy({ allowedDomains: allowlist });

    const model = modelConfig();
    stagehand = await Stagehand.create(model ? { browser, model } : { browser });

    const [existing] = await browser.context.pages();
    const page = existing ?? (await browser.context.newPage());

    const result = await adapter.run({ stagehand, page, connection, check, allowlist, evidence });
    return {
      ...result,
      evidence,
      execution: { browserProvider: "browserbase", automation: "stagehand", sessionId },
    };
  } catch (err) {
    err.evidence = evidence;
    throw err;
  } finally {
    await stagehand?.close().catch(() => {});
    await browser?.close().catch(() => {});
    log.info("browserbase session closed", { sessionId });
  }
}

export async function shutdown() {}
