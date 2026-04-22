import type { Booking } from "./baselineSchemas";

// Realistic synthetic dataset for dev/testing.
// Distributions are tuned so the recommendation engine triggers all 4 rules:
// - ADR > cap (+8%) in some cities
// - compliance < 75% in at least one city
// - leakage > 15% globally
// - top-2 concentration > 50% in at least one city
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

// Deterministic PRNG so demo data is reproducible across reloads.
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

export function generateDemoBookings(count = 500): Booking[] {
  const rand = mulberry32(42);
  const bookings: Booking[] = [];
  const startDate = new Date(2025, 0, 1).getTime();
  const endDate = new Date(2025, 9, 31).getTime();

  for (let i = 0; i < count; i++) {
    // Weighted city pick — São Paulo and Rio dominate to create concentration patterns.
    const r = rand();
    const cityIdx =
      r < 0.32 ? 0 : r < 0.55 ? 1 : r < 0.7 ? 2 : r < 0.82 ? 3 : r < 0.92 ? 4 : 5;
    const c = CITIES[cityIdx];

    // Hotel pick — first two hotels of each city get ~60% of bookings to trigger
    // the "top-2 > 50%" supplier-concentration rule in some cities.
    const hr = rand();
    const hotelIdx =
      hr < 0.38
        ? 0
        : hr < 0.62
          ? 1
          : Math.min(c.hotels.length - 1, 2 + Math.floor(rand() * (c.hotels.length - 2)));
    const hotel = c.hotels[hotelIdx];

    // ADR distribution — base + noise + occasional out-of-policy spikes.
    const noise = (rand() - 0.5) * 60;
    const spike = rand() < 0.18 ? rand() * 90 : 0; // ~18% over-policy bookings → leakage > 15%
    const adr = Math.max(110, Math.round(c.baseAdr + noise + spike));

    const room_nights = 1 + Math.floor(rand() * 5); // 1–5 nights
    const checkinTs = startDate + Math.floor(rand() * (endDate - startDate));
    const checkin = new Date(checkinTs).toISOString().slice(0, 10);
    const channel = CHANNELS[Math.floor(rand() * CHANNELS.length)];

    bookings.push({
      booking_id: `DEMO-${String(i + 1).padStart(5, "0")}`,
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
