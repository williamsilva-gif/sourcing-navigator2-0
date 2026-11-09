import { describe, expect, it } from "vitest";
import { applyRoute, needsRoute, parseDuration, parseRoutesBody, routeCandidates, routesRequest } from "@/lib/proximity/routes";
import type { Pair } from "@/lib/proximity/core";
const pair = (unitId: string, kind: "office" | "store", km: number, cross = false): Pair =>
  ({ hotelId: "h", unitId, kind, km, band: "", definitive: false, nearest: false, boundary: false, cross });
describe("proximity routes", () => {
  it("parses duration strings", () => {
    expect(parseDuration("123s")).toBe(123);
    expect(parseDuration("12.5s")).toBe(12.5);
    expect(parseDuration("x")).toBeNull();
  });
  it("parses distance and duration, never invents", () => {
    expect(parseRoutesBody({ routes: [{ distanceMeters: 1234, duration: "300s" }] })).toEqual({ status: "calculado", meters: 1234, durationSec: 300 });
    expect(parseRoutesBody({}).status).toBe("erro");
    expect(parseRoutesBody({ routes: [{ distanceMeters: 10 }] }).status).toBe("erro");
  });
  it("builds WALK request", () => {
    expect(routesRequest({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, "WALK").travelMode).toBe("WALK");
  });
  it("top 3 per kind, same municipality by default, single pair", () => {
    const ps = [pair("a","office",5), pair("b","office",1), pair("c","office",2), pair("d","office",3), pair("x","office",0.1,true), pair("s","store",4)];
    expect(routeCandidates(ps, "h").map((p) => p.unitId)).toEqual(["b","c","d","s"]);
    expect(routeCandidates(ps, "h", { allowCross: true }).map((p) => p.unitId)[0]).toBe("x");
    expect(routeCandidates(ps, "h", { unitId: "a" }).map((p) => p.unitId)).toEqual(["a"]);
  });
  it("applies results separately from straight line and keeps legacy roadKm", () => {
    const p = pair("a", "office", 0.52);
    applyRoute(p, "DRIVE", { status: "calculado", meters: 900, durationSec: 180 }, "t");
    applyRoute(p, "WALK", { status: "erro", error: "ROUTE_NOT_FOUND" }, "t");
    expect(p.km).toBe(0.52);
    expect(p.roadKm).toBe(0.9);
    expect(p.walkKm).toBeUndefined();
    expect(p.walkStatus).toBe("erro");
    expect(needsRoute(p, "DRIVE")).toBe(false);
    expect(needsRoute(p, "WALK")).toBe(true);
  });
  it("legacy roadKm without status counts as calculated", () => {
    const p = { ...pair("a", "office", 1), roadKm: 2 };
    expect(needsRoute(p, "DRIVE")).toBe(false);
  });
});
