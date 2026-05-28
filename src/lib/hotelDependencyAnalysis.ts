// Hotel Dependency Score
// Detects excessive concentration of room nights on a single hotel within a city.
import type { Booking, Contract } from "./baselineSchemas";

export interface DependencyRow {
  city: string;
  topHotel: string;
  topHotelRn: number;
  totalCityRn: number;
  concentrationPct: number; // topHotelRn / totalCityRn * 100
  contractedAlternatives: number; // # other contracted hotels in city
  topHotelIsContracted: boolean;
  bookings: number;
  severity: "high" | "medium" | "low";
  riskNotes: string[];
}

export interface DependencySummary {
  rows: DependencyRow[];
  flaggedCities: number;
  worstConcentrationPct: number;
  worstCity: string | null;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function severityFor(pct: number): DependencyRow["severity"] {
  if (pct >= 70) return "high";
  if (pct >= 60) return "medium";
  return "low";
}

export function computeHotelDependency(
  bookings: Booking[],
  contracts: Contract[],
): DependencySummary {
  const contractedByCity = new Map<string, Set<string>>();
  const contractedHotels = new Set(contracts.map((c) => c.hotel.trim().toLowerCase()));

  // Group bookings by city → hotel → RN
  type Agg = { hotel: string; rn: number; count: number };
  const byCity = new Map<string, { totalRn: number; bookings: number; hotels: Map<string, Agg> }>();
  for (const b of bookings) {
    const ck = b.city.trim();
    if (!ck) continue;
    const key = ck.toLowerCase();
    const cityEntry =
      byCity.get(key) ?? { totalRn: 0, bookings: 0, hotels: new Map<string, Agg>() };
    cityEntry.totalRn += b.room_nights;
    cityEntry.bookings += 1;
    const hk = b.hotel.trim().toLowerCase();
    const cur = cityEntry.hotels.get(hk) ?? { hotel: b.hotel.trim(), rn: 0, count: 0 };
    cur.rn += b.room_nights;
    cur.count += 1;
    cityEntry.hotels.set(hk, cur);
    byCity.set(key, cityEntry);

    // Track contracted hotels per city
    if (contractedHotels.has(hk)) {
      const set = contractedByCity.get(key) ?? new Set<string>();
      set.add(hk);
      contractedByCity.set(key, set);
    }
  }

  const rows: DependencyRow[] = [];
  for (const [cityKey, entry] of byCity) {
    if (entry.totalRn < 20) continue; // ignore noise
    const hotels = Array.from(entry.hotels.values()).sort((a, b) => b.rn - a.rn);
    const top = hotels[0];
    if (!top) continue;
    const pct = (top.rn / entry.totalRn) * 100;
    if (pct < 50) continue;
    const isContracted = contractedHotels.has(top.hotel.toLowerCase());
    const altSet = contractedByCity.get(cityKey) ?? new Set<string>();
    const alternatives = Math.max(0, altSet.size - (isContracted ? 1 : 0));

    const notes: string[] = [];
    notes.push(
      `${top.hotel} concentra ${pct.toFixed(0)}% do volume da cidade — risco de leverage perdido na próxima negociação.`,
    );
    if (!isContracted) {
      notes.push("Hotel dominante não é contratado — exposição a tarifas de balcão e baixa governança.");
    }
    if (alternatives < 2) {
      notes.push("Diretório atual oferece poucas alternativas contratadas — risco operacional em caso de sold out.");
    }
    if (pct >= 70) {
      notes.push("Single point of failure: indisponibilidade do hotel impacta a maioria das viagens da cidade.");
    }

    rows.push({
      city: bookings.find((b) => b.city.trim().toLowerCase() === cityKey)?.city.trim() ?? cityKey,
      topHotel: top.hotel,
      topHotelRn: top.rn,
      totalCityRn: entry.totalRn,
      concentrationPct: pct,
      contractedAlternatives: alternatives,
      topHotelIsContracted: isContracted,
      bookings: entry.bookings,
      severity: severityFor(pct),
      riskNotes: notes,
    });
  }

  rows.sort((a, b) => b.concentrationPct - a.concentrationPct);
  return {
    rows,
    flaggedCities: rows.length,
    worstConcentrationPct: rows[0]?.concentrationPct ?? 0,
    worstCity: rows[0]?.city ?? null,
  };
}

export function dependencySignature(periodLabel: string, row: DependencyRow): string {
  return `hoteldep:${slug(periodLabel)}:${slug(row.city)}:${slug(row.topHotel)}`;
}
