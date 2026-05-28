// Savings Missed — informational rollup of value lost to leakage + low adoption.
import type { Booking, Contract } from "./baselineSchemas";

export interface SavingsMissedBreakdown {
  source: "out_of_directory" | "underperformance" | "adoption";
  label: string;
  amount: number;
  detail: string;
}

export interface SavingsMissedSummary {
  totalMissed: number;
  outOfDirectoryAmount: number;
  outOfDirectoryRn: number;
  outOfDirectoryBookings: number;
  underperformanceAmount: number;
  underperformanceRn: number;
  adoptionAmount: number; // approximate
  breakdown: SavingsMissedBreakdown[];
  topCity: string | null;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function computeSavingsMissed(
  bookings: Booking[],
  contracts: Contract[],
  underperformanceTotal: number,
  underperformanceRn: number,
): SavingsMissedSummary {
  const contractedHotels = new Set(contracts.map((c) => c.hotel.trim().toLowerCase()));

  // Per-city average negotiated ADR (using bookings to attach city to contracts)
  const cityAvgNegotiated = new Map<string, { sum: number; n: number }>();
  for (const c of contracts) {
    const sample = bookings.find(
      (b) => b.hotel.trim().toLowerCase() === c.hotel.trim().toLowerCase(),
    );
    const ck = (sample?.city ?? "").trim().toLowerCase();
    if (!ck) continue;
    const cur = cityAvgNegotiated.get(ck) ?? { sum: 0, n: 0 };
    cur.sum += c.negotiated_adr;
    cur.n += 1;
    cityAvgNegotiated.set(ck, cur);
  }

  // Out-of-directory rollup
  const cityMissed = new Map<string, number>();
  let outAmount = 0;
  let outRn = 0;
  let outBookings = 0;
  for (const b of bookings) {
    const key = b.hotel.trim().toLowerCase();
    if (contractedHotels.has(key)) continue;
    const ck = b.city.trim().toLowerCase();
    const avg = cityAvgNegotiated.get(ck);
    if (!avg || avg.n === 0) continue;
    const negotiated = avg.sum / avg.n;
    const perRn = Math.max(0, b.adr - negotiated);
    const missed = perRn * b.room_nights;
    outAmount += missed;
    outRn += b.room_nights;
    outBookings += 1;
    if (missed > 0) {
      cityMissed.set(ck, (cityMissed.get(ck) ?? 0) + missed);
    }
  }

  // Adoption: under-utilization of contracted hotels = approx underperformance signal,
  // but kept distinct as informational lever; we expose 0 unless caller provides extra data.
  const adoptionAmount = 0;

  let topCity: string | null = null;
  let topVal = 0;
  for (const [ck, v] of cityMissed) {
    if (v > topVal) {
      topVal = v;
      topCity =
        bookings.find((b) => b.city.trim().toLowerCase() === ck)?.city.trim() ?? ck;
    }
  }

  const breakdown: SavingsMissedBreakdown[] = [
    {
      source: "out_of_directory",
      label: "Reservas fora do diretório",
      amount: outAmount,
      detail: `${outBookings.toLocaleString("pt-BR")} reservas · ${outRn.toLocaleString("pt-BR")} room nights pagando acima do ADR negociado médio`,
    },
    {
      source: "underperformance",
      label: "Hotéis contratados subutilizados",
      amount: underperformanceTotal,
      detail: `${Math.round(underperformanceRn).toLocaleString("pt-BR")} room nights abaixo do volume esperado nos hotéis com contrato`,
    },
    {
      source: "adoption",
      label: "Adoção do programa",
      amount: adoptionAmount,
      detail: "Estimativa de savings não capturados por reservas fora dos canais oficiais (em construção)",
    },
  ];

  return {
    totalMissed: outAmount + underperformanceTotal + adoptionAmount,
    outOfDirectoryAmount: outAmount,
    outOfDirectoryRn: outRn,
    outOfDirectoryBookings: outBookings,
    underperformanceAmount: underperformanceTotal,
    underperformanceRn,
    adoptionAmount,
    breakdown,
    topCity,
  };
}

export function savingsMissedSignature(periodLabel: string): string {
  return `savingsmissed:${slug(periodLabel)}`;
}
