// Deterministic normalizers used by the Rate Loading comparator.
import type { RateBasis } from "./types";

/** Normalize a currency string to an ISO-4217-ish uppercase code. */
export function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const symbols: Record<string, string> = {
    "R$": "BRL",
    "US$": "USD",
    $: "USD",
    "€": "EUR",
    "£": "GBP",
    REAIS: "BRL",
    REAL: "BRL",
    DOLAR: "USD",
    DOLLARS: "USD",
    EUROS: "EUR",
  };
  if (symbols[s]) return symbols[s]!;
  const iso = s.match(/\b([A-Z]{3})\b/);
  if (iso) return iso[1]!;
  return null;
}

/** Convert a rate to per-night basis. Returns null when it cannot be normalized. */
export function toPerNight(
  amount: number | null | undefined,
  basis: RateBasis | null | undefined,
  nights: number | null | undefined,
): number | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  const b = basis ?? "per_night";
  if (b === "per_night") return amount;
  const n = nights ?? 0;
  if (!n || n <= 0) return null;
  return amount / n;
}

/** Nights between two ISO dates (check-out exclusive). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

const AMENITY_ALIASES: Record<string, string[]> = {
  BREAKFAST: [
    "breakfast",
    "breakfast included",
    "complimentary breakfast",
    "buffet breakfast",
    "cafe da manha",
    "café da manhã",
    "cafe da manha incluso",
    "café da manhã incluído",
    "desayuno",
    "american breakfast",
    "continental breakfast",
  ],
  WIFI: [
    "wifi",
    "wi-fi",
    "wi fi",
    "wireless internet",
    "complimentary wifi",
    "free wifi",
    "internet included",
    "internet incluso",
    "internet gratuita",
  ],
  PARKING: [
    "parking",
    "free parking",
    "estacionamento",
    "estacionamento gratuito",
    "self parking",
    "valet parking",
    "garagem",
  ],
  GYM: ["gym", "fitness", "fitness center", "academia"],
  LRA: ["lra", "last room availability", "ultima disponibilidade"],
  AIRPORT_SHUTTLE: ["airport shuttle", "shuttle", "transfer aeroporto", "traslado"],
};

function deaccent(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a free-text amenity to a canonical key, or null when unknown. */
export function canonicalAmenity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = deaccent(raw);
  const direct = s.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (AMENITY_ALIASES[direct]) return direct;
  for (const [canon, aliases] of Object.entries(AMENITY_ALIASES)) {
    for (const alias of aliases) {
      const a = deaccent(alias);
      if (s === a || s.includes(a)) return canon;
    }
  }
  return direct || null;
}

export function canonicalAmenities(list: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const item of list) {
    const c = canonicalAmenity(item);
    if (c) out.add(c);
  }
  return [...out].sort();
}

export interface NormalizedCancellation {
  refundable: boolean | null;
  free_cancel_hours: number | null;
  penalty_type: "nights" | "amount" | "percent" | "none" | null;
  penalty_value: number | null;
  confidence: number;
}

/** Best-effort deterministic parse of a cancellation policy string. */
export function normalizeCancellation(raw: string | null | undefined): NormalizedCancellation {
  const empty: NormalizedCancellation = {
    refundable: null,
    free_cancel_hours: null,
    penalty_type: null,
    penalty_value: null,
    confidence: 0,
  };
  if (!raw) return empty;
  const s = deaccent(raw);

  if (/non[- ]?refundable|nao reembolsavel|sem reembolso|no refund/.test(s)) {
    return { refundable: false, free_cancel_hours: 0, penalty_type: "percent", penalty_value: 100, confidence: 0.95 };
  }

  const hours = s.match(/(\d{1,3})\s*(h|hours?|horas?)/);
  const days = s.match(/(\d{1,2})\s*(d|days?|dias?)/);
  let freeHours: number | null = null;
  if (hours) freeHours = Number(hours[1]);
  else if (days) freeHours = Number(days[1]) * 24;

  const nightsPenalty = s.match(/(\d{1,2})\s*(night|noite)/);
  const percentPenalty = s.match(/(\d{1,3})\s*%/);

  const refundable = /free cancel|cancelamento gratuito|refundable|reembolsavel|cancel until|ate/.test(s)
    ? true
    : freeHours !== null
      ? true
      : null;

  const confidence = freeHours !== null ? 0.85 : refundable !== null ? 0.5 : 0.2;

  return {
    refundable,
    free_cancel_hours: freeHours,
    penalty_type: nightsPenalty ? "nights" : percentPenalty ? "percent" : freeHours !== null ? "none" : null,
    penalty_value: nightsPenalty ? Number(nightsPenalty[1]) : percentPenalty ? Number(percentPenalty[1]) : null,
    confidence,
  };
}

/** Detect LRA / NLRA from free text. Returns null when the text is inconclusive. */
export function normalizeLra(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  const s = deaccent(raw);
  if (/\bnlra\b|non[- ]?lra|sem lra|no last room/.test(s)) return false;
  if (/\blra\b|last room availability/.test(s)) return true;
  return null;
}
