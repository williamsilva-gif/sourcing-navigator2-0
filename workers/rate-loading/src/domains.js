// Allowlist derived from the portal connection (base URL host) plus domains
// declared explicitly per adapter via env (e.g. SSO/login hosts).

export function buildAllowlist(baseUrl, extraEnv) {
  const host = new URL(baseUrl).hostname.toLowerCase();
  const extra = String(extraEnv ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([host, ...extra]));
}

export function isHostAllowed(rawUrl, allowlist) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol === "about:" || u.protocol === "data:") return true;
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return allowlist.some((d) => h === d || h.endsWith(`.${d}`));
}

export function domainError(url) {
  const err = new Error(`navigation to non-allowed domain: ${safeHost(url)}`);
  err.code = "DOMAIN_NOT_ALLOWED";
  return err;
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}
