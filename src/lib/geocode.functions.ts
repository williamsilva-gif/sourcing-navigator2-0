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
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input: data.query,
          languageCode: "pt-BR",
          regionCode: "br",
          includedRegionCodes: ["br"],
          sessionToken: data.sessionToken,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, predictions: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId: string;
            text?: { text: string };
            structuredFormat?: {
              mainText?: { text: string };
              secondaryText?: { text: string };
            };
          };
        }>;
      };
      return {
        ok: true,
        predictions: (json.suggestions ?? [])
          .filter((s) => s.placePrediction)
          .map((s) => ({
            description: s.placePrediction!.text?.text ?? "",
            placeId: s.placePrediction!.placeId,
            mainText: s.placePrediction!.structuredFormat?.mainText?.text,
            secondaryText: s.placePrediction!.structuredFormat?.secondaryText?.text,
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
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}?languageCode=pt-BR`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,formattedAddress,location",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        id?: string;
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
      };
      if (!json.location) return { ok: false, error: "Sem location no resultado" };
      return {
        ok: true,
        lat: json.location.latitude,
        lng: json.location.longitude,
        displayName: json.formattedAddress ?? "",
        placeId: json.id,
        locationType: "ROOFTOP",
        partialMatch: false,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
