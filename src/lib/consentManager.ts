// ConsentManager — LGPD/GDPR compliant consent storage.
// Stores user choices in localStorage and (when authenticated) mirrors the
// event in the `consent_logs` table for auditability.

import { supabase } from "@/integrations/supabase/client";

export type ConsentType =
  | "cookies_essential"
  | "cookies_functional"
  | "cookies_analytics"
  | "cookies_marketing"
  | "marketing_email"
  | "terms"
  | "privacy_policy";

export const POLICY_VERSION = "v1.0";
const STORAGE_KEY = "cookie_consent";
const HISTORY_KEY = "cookie_consent_history";

export interface ConsentState {
  cookies_essential: boolean; // always true
  cookies_functional: boolean;
  cookies_analytics: boolean;
  cookies_marketing: boolean;
  marketing_email?: boolean;
  decidedAt?: string;
  policyVersion?: string;
}

export interface ConsentHistoryEntry {
  type: ConsentType;
  granted: boolean;
  at: string;
  policyVersion: string;
}

const DEFAULT_STATE: ConsentState = {
  cookies_essential: true,
  cookies_functional: false,
  cookies_analytics: false,
  cookies_marketing: false,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

const listeners = new Set<(s: ConsentState) => void>();

export const consentManager = {
  hasDecided(): boolean {
    if (!isBrowser()) return false;
    return Boolean(localStorage.getItem(STORAGE_KEY));
  },

  getState(): ConsentState {
    if (!isBrowser()) return DEFAULT_STATE;
    return safeParse<ConsentState>(localStorage.getItem(STORAGE_KEY), DEFAULT_STATE);
  },

  getConsent(type: ConsentType): boolean {
    if (type === "cookies_essential") return true;
    const s = this.getState();
    return Boolean((s as unknown as Record<string, unknown>)[type]);
  },

  setConsent(type: ConsentType, value: boolean) {
    if (!isBrowser()) return;
    if (type === "cookies_essential") return; // cannot be disabled
    const s = this.getState();
    const next: ConsentState = {
      ...s,
      [type]: value,
      cookies_essential: true,
      decidedAt: new Date().toISOString(),
      policyVersion: POLICY_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    appendHistory({ type, granted: value, at: next.decidedAt!, policyVersion: POLICY_VERSION });
    void logToServer(type, value);
    listeners.forEach((fn) => fn(next));
  },

  setBulk(values: Partial<Record<ConsentType, boolean>>) {
    if (!isBrowser()) return;
    const now = new Date().toISOString();
    const s = this.getState();
    const next: ConsentState = {
      ...s,
      ...values,
      cookies_essential: true,
      decidedAt: now,
      policyVersion: POLICY_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    Object.entries(values).forEach(([type, granted]) => {
      if (type === "cookies_essential") return;
      appendHistory({
        type: type as ConsentType,
        granted: Boolean(granted),
        at: now,
        policyVersion: POLICY_VERSION,
      });
      void logToServer(type as ConsentType, Boolean(granted));
    });
    listeners.forEach((fn) => fn(next));
  },

  acceptAll() {
    this.setBulk({
      cookies_functional: true,
      cookies_analytics: true,
      cookies_marketing: true,
    });
  },

  rejectAll() {
    this.setBulk({
      cookies_functional: false,
      cookies_analytics: false,
      cookies_marketing: false,
    });
  },

  revokeAll() {
    if (!isBrowser()) return;
    localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((fn) => fn(DEFAULT_STATE));
  },

  getConsentHistory(): ConsentHistoryEntry[] {
    if (!isBrowser()) return [];
    return safeParse<ConsentHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
  },

  subscribe(fn: (s: ConsentState) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function appendHistory(entry: ConsentHistoryEntry) {
  if (!isBrowser()) return;
  const current = safeParse<ConsentHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
  current.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current.slice(0, 200)));
}

async function logToServer(type: ConsentType, granted: boolean) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    await supabase.from("consent_logs").insert({
      user_id: uid,
      consent_type: type,
      granted,
      policy_version: POLICY_VERSION,
      user_agent: isBrowser() ? navigator.userAgent : null,
    });
  } catch {
    /* best-effort */
  }
}
