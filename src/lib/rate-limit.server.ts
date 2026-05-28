import { createClient } from "@supabase/supabase-js";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

function adminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(
      `Muitas requisições. Tente novamente em ${retryAfterSeconds}s.`,
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "rfp:create" */
  bucket: string;
  /** Discriminator (user id, tenant id, IP, token...) */
  key: string;
  /** Max requests allowed within the window */
  max: number;
  /** Window length in seconds */
  windowSeconds: number;
}

/**
 * Atomically increments the counter for {bucket}:{key} and throws RateLimitError
 * if the limit is exceeded. On any internal error we fail-open (log + allow)
 * so rate limiting outages never block legitimate traffic.
 */
export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const supabase = adminClient();
  const compositeKey = `${opts.bucket}:${opts.key}`;

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      _key: compositeKey,
      _max: opts.max,
      _window_seconds: opts.windowSeconds,
    });
    if (error) {
      console.warn("[rate-limit] check failed, allowing:", error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      throw new RateLimitError(row.retry_after_seconds ?? opts.windowSeconds);
    }
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    console.warn("[rate-limit] unexpected error, allowing:", e);
  }
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(): string {
  try {
    const fwd = getRequestHeader("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = getRequestHeader("x-real-ip");
    if (real) return real;
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf;
    const req = getRequest();
    return req?.headers.get("host") ?? "unknown";
  } catch {
    return "unknown";
  }
}
