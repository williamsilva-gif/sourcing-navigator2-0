import { describe, expect, it, vi } from "vitest";
import { ROUTE_FIELD_MASK, runIsolatedRouteTest, sanitizeRouteError } from "@/lib/proximity/route-test";

describe("isolated Routes diagnostic", () => {
  it("makes exactly DRIVE/WALK calls with the authorized fixed coordinates and parses real-response units", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ routes: [{ distanceMeters: 901, duration: "123.5s" }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ routes: [{ distanceMeters: 702, duration: "600s" }] })));
    const results = await runIsolatedRouteTest({ isMaster: true, key: "secret", gateway: false, request });
    expect(request).toHaveBeenCalledTimes(2);
    for (const [index, mode] of ["DRIVE", "WALK"].entries()) {
      const init = request.mock.calls[index][1];
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "X-Goog-FieldMask": ROUTE_FIELD_MASK });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        origin: { location: { latLng: { latitude: -1.4547326, longitude: -48.4890030 } } },
        destination: { location: { latLng: { latitude: -1.4502282, longitude: -48.4884451 } } }, travelMode: mode,
      });
    }
    expect(results.map((r) => [r.meters, r.seconds])).toEqual([[901, 123.5], [702, 600]]);
  });
  it("denies non-master before any Google request", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(runIsolatedRouteTest({ isMaster: false, key: "secret", gateway: false, request })).rejects.toThrow("TA master");
    expect(request).not.toHaveBeenCalled();
  });
  it("reports each 403 with sanitized provider evidence and never retries", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response('API_KEY_SERVICE_BLOCKED secret; project 592548124736 disabled', { status: 403 }));
    const results = await runIsolatedRouteTest({ isMaster: true, key: "secret", auth: "gateway-secret", gateway: true, request });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe("https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes");
    expect(request.mock.calls[0][1]?.headers).toMatchObject({ "X-Connection-Api-Key": "secret", Authorization: "Bearer gateway-secret" });
    expect(results.every((r) => r.httpStatus === 403 && r.meters === null && r.seconds === null)).toBe(true);
    expect(results[0].error).toContain("API_KEY_SERVICE_BLOCKED");
    expect(JSON.stringify(results)).not.toContain("secret");
  });
  it("does not invent route values on empty, malformed or network responses", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}')).mockRejectedValueOnce(new Error('network secret'));
    const results = await runIsolatedRouteTest({ isMaster: true, key: "secret", gateway: false, request });
    expect(results.every((r) => r.error && r.meters === null && r.seconds === null)).toBe(true);
    expect(results[1].httpStatus).toBeNull();
    expect(results[1].error).not.toContain("secret");
  });
  it("missing credentials cause zero billable calls", async () => {
    const request = vi.fn<typeof fetch>();
    const results = await runIsolatedRouteTest({ isMaster: true, gateway: true, request });
    expect(request).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.meters === null && r.error)).toBe(true);
  });
  it("redacts literal keys, Google keys and bearer credentials", () => {
    expect(sanitizeRouteError('private AIzaabcdef Bearer token', ['private'])).toBe('[oculto] [oculto] Bearer [oculto]');
  });
});