// Free geocoding via OpenStreetMap Nominatim. No API key required.
// For production volume, swap for Google Geocoding API (requires key).

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: "high" | "medium" | "low";
  raw: unknown;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Falha no geocode (${res.status})`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; importance?: number }>;
  if (!data || data.length === 0) return null;
  const top = data[0];
  const importance = top.importance ?? 0;
  const confidence: GeocodeResult["confidence"] = importance > 0.6 ? "high" : importance > 0.35 ? "medium" : "low";
  return {
    lat: parseFloat(top.lat),
    lng: parseFloat(top.lon),
    displayName: top.display_name,
    confidence,
    raw: top,
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
