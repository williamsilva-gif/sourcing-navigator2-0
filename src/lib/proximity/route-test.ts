import { parseRoutesBody, routesRequest, type TravelMode } from "./routes";

export const TEST_ORIGIN = { lat: -1.4547326, lng: -48.489003 };
export const TEST_DESTINATION = { lat: -1.4502282, lng: -48.4884451 };
export const TEST_MODES: TravelMode[] = ["DRIVE", "WALK"];
export const ROUTE_FIELD_MASK = "routes.distanceMeters,routes.duration";

export type RouteTestResult = {
  mode: TravelMode;
  source: string;
  httpStatus: number | null;
  at: string;
  meters: number | null;
  seconds: number | null;
  error: string | null;
};

export function sanitizeRouteError(text: string, secrets: string[]) {
  let safe = text;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join("[oculto]");
  }
  return safe
    .replace(/AIza[\w-]+/g, "[oculto]")
    .replace(/Bearer\s+[^\s"<>]+/gi, "Bearer [oculto]")
    .slice(0, 4000);
}

/** Fixed pair, at most two calls, no job access, no retries or automatic fallback. */
export async function runIsolatedRouteTest(options: {
  isMaster: boolean;
  key?: string;
  auth?: string;
  gateway: boolean;
  request: typeof fetch;
}): Promise<RouteTestResult[]> {
  if (!options.isMaster) throw new Error("Acesso restrito a TA master.");
  const { key, auth, gateway, request } = options;
  const results: RouteTestResult[] = [];
  for (const mode of TEST_MODES) {
    const result: RouteTestResult = {
      mode,
      source: `Google Routes v2 computeRoutes — ${mode}`,
      httpStatus: null,
      at: new Date().toISOString(),
      meters: null,
      seconds: null,
      error: null,
    };
    if (!key || (gateway && !auth)) {
      result.error = !key
        ? "GOOGLE_MAPS_API_KEY ausente no servidor."
        : "Credencial do conector Google ausente.";
      results.push(result);
      continue;
    }
    try {
      const response = await request(
        gateway
          ? "https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes"
          : "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-FieldMask": ROUTE_FIELD_MASK,
            ...(gateway
              ? { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key }
              : { "X-Goog-Api-Key": key }),
          },
          body: JSON.stringify(routesRequest(TEST_ORIGIN, TEST_DESTINATION, mode)),
          signal: AbortSignal.timeout(15000),
        },
      );
      result.httpStatus = response.status;
      const text = await response.text();
      if (!response.ok) {
        const hint =
          response.status === 403
            ? " Após ativação, pode haver atraso de propagação; também confira restrições da chave e faturamento. O erro abaixo identifica a recusa do Google."
            : "";
        result.error = `HTTP ${response.status}.${hint} ${sanitizeRouteError(text, [key, auth ?? ""])}`;
      } else {
        const parsed = parseRoutesBody(JSON.parse(text));
        if (parsed.status === "calculado") {
          result.meters = parsed.meters;
          result.seconds = parsed.durationSec;
        } else result.error = parsed.error;
      }
    } catch (error) {
      result.error = sanitizeRouteError(
        error instanceof Error ? error.message : "Falha de rede ou resposta inválida.",
        [key, auth ?? ""],
      );
    }
    results.push(result);
  }
  return results;
}

export function testMapsLink(mode: TravelMode) {
  return `https://www.google.com/maps/dir/?api=1&origin=${TEST_ORIGIN.lat},${TEST_ORIGIN.lng}&destination=${TEST_DESTINATION.lat},${TEST_DESTINATION.lng}&travelmode=${mode === "DRIVE" ? "driving" : "walking"}`;
}
