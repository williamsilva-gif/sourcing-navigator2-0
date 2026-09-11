// SSRF protection: portal navigation is restricted to adapter-approved domains.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export interface AllowlistDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Validate a URL against an adapter's allowed domain list.
 * Requires HTTPS, a non-private host, and a hostname matching an allowed
 * domain exactly or as a subdomain.
 */
export function isUrlAllowed(rawUrl: string, allowedDomains: readonly string[]): AllowlistDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:") {
    // http is tolerated only for the in-repo mock portal on an explicit allowlist entry
    const isMock = allowedDomains.some((d) => d.startsWith("mock:"));
    if (!(isMock && url.protocol === "http:")) {
      return { allowed: false, reason: "protocol_not_https" };
    }
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) && !allowedDomains.some((d) => d === `mock:${host}`)) {
    return { allowed: false, reason: "blocked_hostname" };
  }
  if (isPrivateIpv4(host) && !allowedDomains.some((d) => d === `mock:${host}`)) {
    return { allowed: false, reason: "private_ip" };
  }
  if (host.includes(":") && isPrivateIpv6(host)) {
    return { allowed: false, reason: "private_ip" };
  }
  if (!host.includes(".") && !allowedDomains.some((d) => d === `mock:${host}`)) {
    return { allowed: false, reason: "internal_hostname" };
  }

  const matched = allowedDomains.some((raw) => {
    const d = raw.replace(/^mock:/, "").toLowerCase();
    return host === d || host.endsWith(`.${d}`);
  });
  if (!matched) return { allowed: false, reason: "domain_not_allowed" };

  return { allowed: true };
}
