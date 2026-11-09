// Pure helpers for Google Routes (DRIVE/WALK). No network here; never invents values.
import type { Pair } from "./core";

export type TravelMode = "DRIVE" | "WALK";
export type RouteStatus = "calculado" | "pendente" | "erro";
export type RouteResult =
  | { status: "calculado"; meters: number; durationSec: number }
  | { status: "erro"; error: string };

export const WALK_WARNING =
  "Rotas a pé Google Routes (WALK) podem não ter calçadas ou caminhos de pedestre completos; distância indicativa.";

/** Parses protobuf duration strings like "123s" or "12.5s"; null if malformed. */
export function parseDuration(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

/** Validates a computeRoutes body. Omitted distanceMeters on a valid route = 0 (protobuf default). */
export function parseRoutesBody(body: unknown): RouteResult {
  const routes = (body as { routes?: Array<{ distanceMeters?: unknown; duration?: unknown }> })
    ?.routes;
  if (!Array.isArray(routes) || !routes.length)
    return { status: "erro", error: "Google Routes não retornou rota (ROUTE_NOT_FOUND)." };
  const r = routes[0];
  const durationSec = parseDuration(r.duration);
  if (durationSec === null) return { status: "erro", error: "Resposta Routes sem duração válida." };
  const meters = r.distanceMeters === undefined ? 0 : Number(r.distanceMeters);
  if (!Number.isFinite(meters) || meters < 0)
    return { status: "erro", error: "Resposta Routes com distância inválida." };
  return { status: "calculado", meters, durationSec };
}

export function routesRequest(
  o: { lat: number; lng: number },
  d: { lat: number; lng: number },
  mode: TravelMode,
) {
  return {
    origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
    destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
    travelMode: mode,
    languageCode: "pt-BR",
    units: "METRIC",
  };
}

/** Selects candidates: one explicit pair, or top N by straight line per category. Same city by default. */
export function routeCandidates(
  pairs: Pair[],
  hotelId: string,
  opts: { unitId?: string; allowCross?: boolean; perKind?: number } = {},
): Pair[] {
  const own = pairs.filter((p) => p.hotelId === hotelId);
  if (opts.unitId) return own.filter((p) => p.unitId === opts.unitId).slice(0, 1);
  const n = Math.min(Math.max(opts.perKind ?? 3, 1), 3);
  return (["office", "store"] as const).flatMap((kind) =>
    own
      .filter((p) => p.kind === kind && (opts.allowCross || !p.cross))
      .sort((a, b) => a.km - b.km)
      .slice(0, n),
  );
}

export function applyRoute(pair: Pair, mode: TravelMode, r: RouteResult, at: string) {
  if (mode === "DRIVE") {
    pair.roadAt = at;
    pair.roadSource = "Google Routes DRIVE";
    if (r.status === "calculado") {
      pair.roadKm = r.meters / 1000;
      pair.roadMeters = r.meters;
      pair.roadDurationSec = r.durationSec;
      pair.roadStatus = "calculado";
      pair.roadError = undefined;
    } else {
      pair.roadStatus = "erro";
      pair.roadError = r.error;
    }
  } else {
    pair.walkAt = at;
    pair.walkSource = "Google Routes WALK (beta)";
    if (r.status === "calculado") {
      pair.walkKm = r.meters / 1000;
      pair.walkMeters = r.meters;
      pair.walkDurationSec = r.durationSec;
      pair.walkStatus = "calculado";
      pair.walkError = undefined;
    } else {
      pair.walkStatus = "erro";
      pair.walkError = r.error;
    }
  }
}

export const routeStatus = (p: Pair, mode: TravelMode): RouteStatus =>
  mode === "DRIVE"
    ? (p.roadStatus ?? (p.roadKm !== undefined ? "calculado" : "pendente"))
    : (p.walkStatus ?? "pendente");

/** True if this mode still needs a call (pending or error; never re-bills a calculated route). */
export const needsRoute = (p: Pair, mode: TravelMode) => routeStatus(p, mode) !== "calculado";

export const fmtDuration = (s?: number) =>
  s === undefined ? "" : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
