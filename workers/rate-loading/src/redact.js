// Log redaction: credentials, tokens and keys must never reach stdout/stderr.
const SENSITIVE = /pass(word)?|secret|token|api[_-]?key|authorization|credential|cookie/i;

export function redact(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Strip any known secret string from free text (e.g. error messages). */
export function scrub(text, secrets = []) {
  let s = String(text ?? "");
  for (const sec of secrets) if (sec && sec.length >= 3) s = s.split(sec).join("[REDACTED]");
  return s;
}

export const log = {
  info: (msg, meta) => console.log(msg, meta ? JSON.stringify(redact(meta)) : ""),
  error: (msg, meta) => console.error(msg, meta ? JSON.stringify(redact(meta)) : ""),
};
