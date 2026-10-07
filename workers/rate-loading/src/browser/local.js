// Local Playwright engine (unchanged behaviour). Used with BROWSER_PROVIDER=local
// against the mock portal for regression and comparison.
import { chromium } from "playwright";
import * as mockAdapter from "../adapters/mock.js";

const ADAPTERS = { [mockAdapter.key]: mockAdapter };
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS ?? 30000);

let browserPromise = null;
function getBrowser() {
  browserPromise ??= chromium.launch({ headless: true });
  return browserPromise;
}

export const name = "local";

export async function execute({ connection, check }) {
  const adapter = ADAPTERS[connection.adapterKey];
  if (!adapter) {
    const err = new Error(`no local adapter for ${connection.adapterKey}`);
    err.code = "UNKNOWN_ERROR";
    throw Object.assign(err, { evidence: [] });
  }
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(NAV_TIMEOUT);
  const page = await context.newPage();
  const evidence = [];
  const shoot = async (type) => {
    const shot = await page.screenshot();
    evidence.push({
      type,
      contentBase64: shot.toString("base64"),
      contentType: "image/png",
      pageUrl: page.url(),
      viewport: "1440x900",
    });
  };
  try {
    await adapter.login(page, connection.baseUrl, connection.credential);
    const offer = await adapter.search(page, connection.baseUrl, check);
    await shoot(offer.found ? "result_screenshot" : "error_screenshot");
    return { offer, evidence, pageUrl: page.url(), execution: { browserProvider: "local", automation: "playwright" } };
  } catch (err) {
    try {
      await shoot("error_screenshot");
    } catch {
      /* best effort */
    }
    err.evidence = evidence;
    err.pageUrl = page.url();
    throw err;
  } finally {
    await context.close().catch(() => {});
  }
}

export async function shutdown() {
  if (browserPromise) await (await browserPromise).close().catch(() => {});
}
