import type { Booking, Contract } from "./baselineSchemas";

// Realistic synthetic dataset for dev/testing.
// Spans 2024 (baseline year) + 2025 (current year) so the Decision Center can
// show actual year-over-year comparisons. 2025 has slightly higher ADR and a
// bit more concentration to surface drift the engine should flag.
const CITIES: { city: string; state: string; baseAdr: number; hotels: string[] }[] = [
  {
    city: "São Paulo",
    state: "SP",
    baseAdr: 310,
    hotels: ["Grand Plaza SP", "Faria Lima Suites", "Paulista Tower", "Itaim Boutique", "Vila Olimpia Inn"],
  },
  {
    city: "Rio de Janeiro",
    state: "RJ",
    baseAdr: 295,
    hotels: ["Copacabana Palace Lite", "Ipanema Beach Hotel", "Leblon Suites", "Botafogo Bay", "Centro Executive"],
  },
  {
    city: "Brasília",
    state: "DF",
    baseAdr: 240,
    hotels: ["Asa Sul Plaza", "Eixo Monumental Inn", "Lago Sul Suites", "Setor Hoteleiro Norte"],
  },
  {
    city: "Belo Horizonte",
    state: "MG",
    baseAdr: 210,
    hotels: ["Savassi Hotel", "Lourdes Plaza", "Funcionários Inn", "Centro BH"],
  },
  {
    city: "Bogotá",
    state: "CO",
    baseAdr: 260,
    hotels: ["Zona T Premium", "Chapinero Suites", "Usaquén Boutique", "Centro Histórico Inn"],
  },
  {
    city: "Cidade do México",
    state: "MX",
    baseAdr: 285,
    hotels: ["Polanco Grand", "Reforma Tower", "Roma Norte Hotel", "Condesa Suites"],
  },
];

const CHANNELS = ["Direct", "GDS", "OTA", "Corporate Tool"];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateForYear(year: number, count: number, seed: number): Booking[] {
  const rand = mulberry32(seed);
  const bookings: Booking[] = [];
  const startDate = new Date(Date.UTC(year, 0, 1)).getTime();
  const endDate = new Date(Date.UTC(year, 11, 31)).getTime();

  // Year-over-year drift: +6% ADR in 2025, +12% spike rate so engine flags it.
  const yoyAdrFactor = year === 2025 ? 1.06 : 1.0;
  const spikeRate = year === 2025 ? 0.22 : 0.16;

  for (let i = 0; i < count; i++) {
    const r = rand();
    const cityIdx =
      r < 0.32 ? 0 : r < 0.55 ? 1 : r < 0.7 ? 2 : r < 0.82 ? 3 : r < 0.92 ? 4 : 5;
    const c = CITIES[cityIdx];

    const hr = rand();
    const hotelIdx =
      hr < 0.38
        ? 0
        : hr < 0.62
          ? 1
          : Math.min(c.hotels.length - 1, 2 + Math.floor(rand() * (c.hotels.length - 2)));
    const hotel = c.hotels[hotelIdx];

    const noise = (rand() - 0.5) * 60;
    const spike = rand() < spikeRate ? rand() * 90 : 0;
    const adr = Math.max(110, Math.round((c.baseAdr + noise + spike) * yoyAdrFactor));

    const room_nights = 1 + Math.floor(rand() * 5);
    const checkinTs = startDate + Math.floor(rand() * (endDate - startDate));
    const checkin = new Date(checkinTs).toISOString().slice(0, 10);
    const channel = CHANNELS[Math.floor(rand() * CHANNELS.length)];

    bookings.push({
      booking_id: `DEMO-${year}-${String(i + 1).padStart(5, "0")}`,
      hotel,
      city: c.city,
      state: c.state,
      checkin,
      room_nights,
      adr,
      channel,
    });
  }

  return bookings;
}

/**
 * Generate demo bookings.
 * - `count` is per-year; default ~500 per year (1.000 total spanning 2024+2025).
 * - Pass a single year to restrict to that year (back-compat for old seed flows).
 */
export function generateDemoBookings(
  count = 500,
  years: number[] = [2024, 2025],
): Booking[] {
  const out: Booking[] = [];
  years.forEach((y, idx) => {
    out.push(...generateForYear(y, count, 42 + idx * 17));
  });
  return out;
}

/**
 * Demo "contratos vigentes" — one row per hotel per year. The negotiated_adr
 * is set just below the average city ADR for that year so leakage shows up
 * naturally. Cap = negotiated_adr × 1.05.
 */
export function generateDemoContracts(years: number[] = [2024, 2025]): Contract[] {
  const out: Contract[] = [];
  for (const year of years) {
    const yoy = year === 2025 ? 1.05 : 1.0; // contracts grow slower than ADR drift
    for (const c of CITIES) {
      c.hotels.forEach((hotel, idx) => {
        // Top hotels negotiate slightly above city base; tail hotels closer to base.
        const tilt = idx === 0 ? 1.04 : idx === 1 ? 1.02 : 0.97;
        const negotiated = Math.round(c.baseAdr * yoy * tilt);
        const cap = Math.round(negotiated * 1.05);
        out.push({
          hotel,
          negotiated_adr: negotiated,
          cap,
          valid_until: `${year}-12-31`,
        });
      });
    }
  }
  return out;
}
