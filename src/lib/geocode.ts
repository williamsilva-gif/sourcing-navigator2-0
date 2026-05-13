// Client-side wrapper that calls the secure server-side Google Geocoding proxy.
import { geocodeAddressFn } from "./geocode.functions";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: "high" | "medium" | "low";
  placeId?: string;
  partialMatch?: boolean;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query.trim()) return null;
  const res = await geocodeAddressFn({ data: { query } });
  if (!res.ok) {
    if (res.error === "Endereço não encontrado") return null;
    throw new Error(res.error ?? "Falha no geocode");
  }
  // Google location_type → confidence
  // ROOFTOP = high, RANGE_INTERPOLATED = medium, GEOMETRIC_CENTER/APPROXIMATE = low
  const confidence: GeocodeResult["confidence"] =
    res.locationType === "ROOFTOP"
      ? "high"
      : res.locationType === "RANGE_INTERPOLATED"
        ? "medium"
        : "low";
  return {
    lat: res.lat!,
    lng: res.lng!,
    displayName: res.displayName!,
    confidence: res.partialMatch ? "low" : confidence,
    placeId: res.placeId,
    partialMatch: res.partialMatch,
  };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
