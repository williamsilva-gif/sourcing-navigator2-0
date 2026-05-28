// Smart Leakage by Distance
// =========================
// Detects bookings made at hotels OUTSIDE the contracted directory when there
// is a contracted hotel within a configurable radius (default 3km) in the same
// city. Uses Google-geocoded hotel coordinates already persisted in the
// baseline (hotels dataset latitude/longitude) and Haversine distance.
import type { Booking, Contract, Hotel } from "./baselineSchemas";
import { distanceMeters } from "./geocode";

export const DEFAULT_LEAKAGE_RADIUS_M = 3000;

export interface LeakedBookingRow {
  hotel: string;
  city: string;
  roomNights: number;
  bookings: number;
  spend: number; // total spend on leaked bookings
  realizedAdr: number;
  // Nearest contracted hotel (within radius), if any
  nearestContractedHotel: string | null;
  nearestContractedAdr: number | null;
  nearestDistanceM: number | null;
  // Estimated savings missed = max(0, realizedAdr - negotiatedAdr) * rn
  missedSavings: number;
}

export interface NearbyUnusedContractedHotel {
  hotel: string;
  city: string;
  contact: string;
  negotiatedAdr: number;
  distanceM: number;
}

export interface CityLeakageGroup {
  city: string;
  // Reference contracted hotel = most-used contracted hotel in the city
  referenceContractedHotel: string | null;
  referenceContractedHotelContact: string | null;
  leakedRows: LeakedBookingRow[];
  nearbyUnusedContracted: NearbyUnusedContractedHotel[];
  // City-level metrics
  totalBookings: number; // bookings in city (in directory + out)
  leakedRoomNights: number;
  totalRoomNights: number;
  leakagePct: number; // leakedRN / totalRN * 100
  missedSavings: number;
  severity: "high" | "medium" | "low" | "ok";
}

export interface DistanceLeakageSummary {
  cityCount: number;
  groups: CityLeakageGroup[];
  totalLeakagePct: number;
  totalMissedSavings: number;
  topCity: string | null;
  flaggedCount: number;
  radiusM: number;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cityKey(s: string): string {
  return s.trim().toLowerCase();
}

function hotelKey(s: string): string {
  return s.trim().toLowerCase();
}

function severityFor(pct: number): CityLeakageGroup["severity"] {
  if (pct >= 25) return "high";
  if (pct >= 10) return "medium";
  if (pct >= 3) return "low";
  return "ok";
}

export function computeDistanceLeakage(
  bookings: Booking[],
  contracts: Contract[],
  hotels: Hotel[],
  radiusM: number = DEFAULT_LEAKAGE_RADIUS_M,
): DistanceLeakageSummary {
  // Index contracts by hotel name
  const contractByHotel = new Map<string, Contract>();
  for (const c of contracts) contractByHotel.set(hotelKey(c.hotel), c);

  // Index hotels (directory) by name → coord/contact
  const hotelByName = new Map<
    string,
    { name: string; city: string; lat?: number; lng?: number; contact: string }
  >();
  for (const h of hotels) {
    hotelByName.set(hotelKey(h.name), {
      name: h.name,
      city: h.city,
      lat: h.latitude,
      lng: h.longitude,
      contact: h.Contact ?? "",
    });
  }

  // For each booking, classify in/out of directory and aggregate per hotel
  type Agg = {
    hotel: string;
    city: string;
    spend: number;
    rn: number;
    count: number;
    inDirectory: boolean;
  };
  const aggByHotel = new Map<string, Agg>();
  for (const b of bookings) {
    const key = hotelKey(b.hotel);
    const inDir = contractByHotel.has(key);
    const cur =
      aggByHotel.get(key) ??
      { hotel: b.hotel, city: b.city, spend: 0, rn: 0, count: 0, inDirectory: inDir };
    cur.spend += b.room_nights * b.adr;
    cur.rn += b.room_nights;
    cur.count += 1;
    aggByHotel.set(key, cur);
  }

  // Group by city
  const byCity = new Map<string, { city: string; aggs: Agg[] }>();
  for (const a of aggByHotel.values()) {
    const k = cityKey(a.city);
    const cur = byCity.get(k) ?? { city: a.city, aggs: [] };
    cur.aggs.push(a);
    byCity.set(k, cur);
  }

  const groups: CityLeakageGroup[] = [];
  let totalRn = 0;
  let totalLeakedRn = 0;
  let totalMissed = 0;

  for (const { city, aggs } of byCity.values()) {
    const inDir = aggs.filter((a) => a.inDirectory);
    const outDir = aggs.filter((a) => !a.inDirectory);

    // Reference contracted hotel = most-used (by room nights) contracted hotel in this city
    const refAgg = inDir.slice().sort((a, b) => b.rn - a.rn)[0] ?? null;
    const refMeta = refAgg ? hotelByName.get(hotelKey(refAgg.hotel)) ?? null : null;

    // Contracted hotels in this city — for distance lookups
    const contractedInCity: Array<{
      name: string;
      city: string;
      lat: number;
      lng: number;
      contact: string;
      negotiatedAdr: number;
      usedRn: number;
    }> = [];
    for (const [hkey, contract] of contractByHotel) {
      const meta = hotelByName.get(hkey);
      if (!meta) continue;
      if (cityKey(meta.city) !== cityKey(city)) continue;
      if (typeof meta.lat !== "number" || typeof meta.lng !== "number") continue;
      const used = aggByHotel.get(hkey)?.rn ?? 0;
      contractedInCity.push({
        name: meta.name,
        city: meta.city,
        lat: meta.lat,
        lng: meta.lng,
        contact: meta.contact,
        negotiatedAdr: contract.negotiated_adr,
        usedRn: used,
      });
    }

    // For each out-of-directory booking aggregate, find nearest contracted hotel
    const leakedRows: LeakedBookingRow[] = [];
    const nearbyUsedContractedNames = new Set<string>();
    for (const a of outDir) {
      const meta = hotelByName.get(hotelKey(a.hotel));
      const realized = a.rn > 0 ? a.spend / a.rn : 0;
      let nearest: typeof contractedInCity[number] | null = null;
      let nearestDist: number | null = null;
      if (meta && typeof meta.lat === "number" && typeof meta.lng === "number") {
        const here = { lat: meta.lat, lng: meta.lng };
        for (const c of contractedInCity) {
          const d = distanceMeters(here, { lat: c.lat, lng: c.lng });
          if (d <= radiusM && (nearestDist === null || d < nearestDist)) {
            nearest = c;
            nearestDist = d;
          }
        }
      }
      const negotiated = nearest?.negotiatedAdr ?? null;
      const missed =
        negotiated != null && realized > negotiated ? (realized - negotiated) * a.rn : 0;
      // Only flag as "leak" when we actually found a nearby contracted alternative
      if (!nearest) continue;
      nearbyUsedContractedNames.add(hotelKey(nearest.name));
      leakedRows.push({
        hotel: a.hotel,
        city: a.city,
        roomNights: a.rn,
        bookings: a.count,
        spend: a.spend,
        realizedAdr: realized,
        nearestContractedHotel: nearest.name,
        nearestContractedAdr: negotiated,
        nearestDistanceM: nearestDist,
        missedSavings: missed,
      });
    }

    // Nearby contracted hotels that are within radius of any leaked booking
    // but have low/zero utilization — surfaced to the user.
    const nearbyUnused: NearbyUnusedContractedHotel[] = [];
    if (refMeta && typeof refMeta.lat === "number" && typeof refMeta.lng === "number") {
      const here = { lat: refMeta.lat, lng: refMeta.lng };
      for (const c of contractedInCity) {
        if (hotelKey(c.name) === hotelKey(refMeta.name)) continue;
        if (c.usedRn > 0) continue; // already used → not "unused"
        const d = distanceMeters(here, { lat: c.lat, lng: c.lng });
        if (d <= radiusM) {
          nearbyUnused.push({
            hotel: c.name,
            city: c.city,
            contact: c.contact,
            negotiatedAdr: c.negotiatedAdr,
            distanceM: d,
          });
        }
      }
      nearbyUnused.sort((a, b) => a.distanceM - b.distanceM);
    }

    const totalCityRn = aggs.reduce((s, a) => s + a.rn, 0);
    const totalCityBookings = aggs.reduce((s, a) => s + a.count, 0);
    const leakedRn = leakedRows.reduce((s, r) => s + r.roomNights, 0);
    const missedSavings = leakedRows.reduce((s, r) => s + r.missedSavings, 0);
    const leakagePct = totalCityRn > 0 ? (leakedRn / totalCityRn) * 100 : 0;
    const severity = severityFor(leakagePct);

    if (leakedRows.length === 0 && nearbyUnused.length === 0) continue;

    groups.push({
      city,
      referenceContractedHotel: refMeta?.name ?? null,
      referenceContractedHotelContact: refMeta?.contact ?? null,
      leakedRows: leakedRows.sort((a, b) => b.missedSavings - a.missedSavings),
      nearbyUnusedContracted: nearbyUnused,
      totalBookings: totalCityBookings,
      leakedRoomNights: leakedRn,
      totalRoomNights: totalCityRn,
      leakagePct,
      missedSavings,
      severity,
    });

    totalRn += totalCityRn;
    totalLeakedRn += leakedRn;
    totalMissed += missedSavings;
  }

  groups.sort((a, b) => b.missedSavings - a.missedSavings);

  const totalLeakagePct = totalRn > 0 ? (totalLeakedRn / totalRn) * 100 : 0;

  return {
    cityCount: groups.length,
    groups,
    totalLeakagePct,
    totalMissedSavings: totalMissed,
    topCity: groups[0]?.city ?? null,
    flaggedCount: groups.filter((g) => g.severity !== "ok").length,
    radiusM,
  };
}

export function distanceLeakageSignature(
  periodLabel: string,
  city: string,
  variant: "account" | "hotel",
  hotelName?: string,
): string {
  const base = `leakdist:${slug(periodLabel)}:${slug(city)}:${variant}`;
  return hotelName ? `${base}:${slug(hotelName)}` : base;
}
