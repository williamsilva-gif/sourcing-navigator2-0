import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().min(3).max(500),
});

export interface GeocodeServerResult {
  ok: boolean;
  lat?: number;
  lng?: number;
  displayName?: string;
  placeId?: string;
  locationType?: string;
  partialMatch?: boolean;
  error?: string;
}

export const geocodeAddressFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<GeocodeServerResult> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "GOOGLE_MAPS_API_KEY não configurada no servidor" };
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(data.query)}&language=pt-BR&region=br&key=${apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return { ok: false, error: `Google Geocoding HTTP ${res.status}` };
      const json = (await res.json()) as {
        status: string;
        error_message?: string;
        results?: Array<{
          formatted_address: string;
          place_id: string;
          partial_match?: boolean;
          geometry: { location: { lat: number; lng: number }; location_type: string };
        }>;
      };
      if (json.status === "ZERO_RESULTS") return { ok: false, error: "Endereço não encontrado" };
      if (json.status !== "OK") return { ok: false, error: json.error_message ?? `Google: ${json.status}` };
      const top = json.results?.[0];
      if (!top) return { ok: false, error: "Sem resultados" };
      return {
        ok: true,
        lat: top.geometry.location.lat,
        lng: top.geometry.location.lng,
        displayName: top.formatted_address,
        placeId: top.place_id,
        locationType: top.geometry.location_type,
        partialMatch: top.partial_match ?? false,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
