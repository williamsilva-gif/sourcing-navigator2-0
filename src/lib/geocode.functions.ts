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

const autocompleteSchema = z.object({
  query: z.string().min(2).max(200),
  sessionToken: z.string().min(1).max(100).optional(),
});

export interface PlacesAutocompleteResult {
  ok: boolean;
  predictions: Array<{ description: string; placeId: string; mainText?: string; secondaryText?: string }>;
  error?: string;
}

export const placesAutocompleteFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => autocompleteSchema.parse(input))
  .handler(async ({ data }): Promise<PlacesAutocompleteResult> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { ok: false, predictions: [], error: "GOOGLE_MAPS_API_KEY ausente" };
    const params = new URLSearchParams({
      input: data.query,
      language: "pt-BR",
      components: "country:br",
      key: apiKey,
    });
    if (data.sessionToken) params.set("sessiontoken", data.sessionToken);
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
      if (!res.ok) return { ok: false, predictions: [], error: `HTTP ${res.status}` };
      const json = (await res.json()) as {
        status: string;
        error_message?: string;
        predictions?: Array<{
          description: string;
          place_id: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }>;
      };
      if (json.status === "ZERO_RESULTS") return { ok: true, predictions: [] };
      if (json.status !== "OK") return { ok: false, predictions: [], error: json.error_message ?? json.status };
      return {
        ok: true,
        predictions: (json.predictions ?? []).map((p) => ({
          description: p.description,
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text,
          secondaryText: p.structured_formatting?.secondary_text,
        })),
      };
    } catch (e) {
      return { ok: false, predictions: [], error: (e as Error).message };
    }
  });

const placeDetailsSchema = z.object({ placeId: z.string().min(1).max(200) });

export const placeDetailsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => placeDetailsSchema.parse(input))
  .handler(async ({ data }): Promise<GeocodeServerResult> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { ok: false, error: "GOOGLE_MAPS_API_KEY ausente" };
    const params = new URLSearchParams({
      place_id: data.placeId,
      fields: "geometry,formatted_address,place_id",
      language: "pt-BR",
      key: apiKey,
    });
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as {
        status: string;
        error_message?: string;
        result?: {
          formatted_address?: string;
          place_id?: string;
          geometry?: { location?: { lat: number; lng: number }; location_type?: string };
        };
      };
      if (json.status !== "OK" || !json.result?.geometry?.location) {
        return { ok: false, error: json.error_message ?? json.status };
      }
      return {
        ok: true,
        lat: json.result.geometry.location.lat,
        lng: json.result.geometry.location.lng,
        displayName: json.result.formatted_address ?? "",
        placeId: json.result.place_id,
        locationType: json.result.geometry.location_type ?? "ROOFTOP",
        partialMatch: false,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
