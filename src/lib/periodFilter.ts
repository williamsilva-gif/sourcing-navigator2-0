// Period windowing helpers — drive the Decision Center / Diagnóstico filters.
// Pure functions, no state. Window bounds are inclusive on `start`, exclusive
// on `end`, both as "YYYY-MM-DD" strings so they compare lexicographically
// against booking.checkin (also YYYY-MM-DD).

import type { Booking } from "./baselineSchemas";

export type Granularity = "year" | "quarter" | "month" | "custom";

export interface PeriodWindow {
  start: string; // inclusive, YYYY-MM-DD
  end: string;   // exclusive, YYYY-MM-DD
  label: string;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Build the current window from granularity + period token. */
export function windowFor(grain: Granularity, period: string): PeriodWindow | null {
  if (grain === "year") {
    const y = Number(period);
    if (!Number.isFinite(y)) return null;
    return { start: ymd(y, 1, 1), end: ymd(y + 1, 1, 1), label: String(y) };
  }
  if (grain === "quarter") {
    // period: "2025-Q3"
    const m = /^(\d{4})-Q([1-4])$/.exec(period);
    if (!m) return null;
    const y = Number(m[1]);
    const q = Number(m[2]);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 3;
    const endY = endMonth > 12 ? y + 1 : y;
    const eM = endMonth > 12 ? endMonth - 12 : endMonth;
    return { start: ymd(y, startMonth, 1), end: ymd(endY, eM, 1), label: `Q${q} ${y}` };
  }
  if (grain === "month") {
    // period: "2025-08"
    const m = /^(\d{4})-(\d{2})$/.exec(period);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const endY = mo === 12 ? y + 1 : y;
    const endMo = mo === 12 ? 1 : mo + 1;
    const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return { start: ymd(y, mo, 1), end: ymd(endY, endMo, 1), label: `${monthLabels[mo - 1]}/${y}` };
  }
  if (grain === "custom") {
    // period: "2025-01-01_2025-06-30"  (end inclusive in the token, exclusive internally)
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(period);
    if (!m) return null;
    const start = m[1];
    // bump end by 1 day to make it exclusive
    const d = new Date(`${m[2]}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const end = d.toISOString().slice(0, 10);
    return { start, end, label: `${m[1]} → ${m[2]}` };
  }
  return null;
}

/** Same-size window immediately before `current`. */
export function previousWindow(current: PeriodWindow): PeriodWindow {
  const startMs = Date.parse(`${current.start}T00:00:00Z`);
  const endMs = Date.parse(`${current.end}T00:00:00Z`);
  const span = endMs - startMs;
  const prevStart = new Date(startMs - span).toISOString().slice(0, 10);
  const prevEnd = current.start;
  return { start: prevStart, end: prevEnd, label: `anterior (${prevStart} → ${prevEnd})` };
}

export function filterByWindow<T extends { checkin?: string }>(rows: T[], w: PeriodWindow | null): T[] {
  if (!w) return rows;
  return rows.filter((r) => {
    const d = r.checkin;
    if (!d) return false;
    return d >= w.start && d < w.end;
  });
}

/** Pick the most recent year that actually has bookings (default for the selector). */
export function defaultPeriod(bookings: Booking[]): { grain: Granularity; period: string } {
  if (!bookings.length) {
    const y = new Date().getUTCFullYear();
    return { grain: "year", period: String(y) };
  }
  const years = new Set<number>();
  for (const b of bookings) {
    const y = Number(b.checkin?.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  const sorted = Array.from(years).sort((a, b) => b - a);
  return { grain: "year", period: String(sorted[0] ?? new Date().getUTCFullYear()) };
}

/** Compute delta vs previous, returning null when previous has zero base. */
export function safeDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
