// Server-only credential encryption for portal connections.
// Plaintext credentials never touch a normal table, a log, or the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env["RATE_LOADING_CREDENTIAL_KEY"];
  if (!raw) throw new Error("RATE_LOADING_CREDENTIAL_KEY is not set");
  // Derive a fixed 32-byte key from the stored secret.
  return createHash("sha256").update(raw).digest();
}

export interface PortalCredential {
  username: string;
  password: string;
}

export function encryptCredential(cred: PortalCredential): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(cred), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptCredential(stored: string): PortalCredential {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return JSON.parse(json) as PortalCredential;
}

/** Mask a username for display: w*****@empresa.com */
export function maskUsername(username: string): string {
  const at = username.indexOf("@");
  if (at > 0) {
    const local = username.slice(0, at);
    const domain = username.slice(at);
    return `${local.slice(0, 1)}${"*".repeat(Math.max(3, local.length - 1))}${domain}`;
  }
  if (username.length <= 2) return "*".repeat(username.length);
  return `${username.slice(0, 1)}${"*".repeat(username.length - 2)}${username.slice(-1)}`;
}
