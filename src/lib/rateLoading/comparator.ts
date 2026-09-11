// RateLoadingComparator — deterministic comparison of the immutable expected
// snapshot against what the portal actually shows. No AI in this path.
import {
  canonicalAmenities,
  canonicalAmenity,
  normalizeCancellation,
  normalizeCurrency,
  toPerNight,
} from "./normalize";
import type {
  ComparisonTolerance,
  ExpectedRateSnapshot,
  Mismatch,
  PortalRateOffer,
  RateLoadingComparisonResult,
  ResultCode,
} from "./types";

/** Severity ranking used to elect the headline result code. */
const MISMATCH_PRIORITY: ResultCode[] = [
  "CURRENCY_MISMATCH",
  "RATE_VALUE_MISMATCH",
  "LRA_MISMATCH",
  "BREAKFAST_MISMATCH",
  "AMENITY_MISMATCH",
  "ROOM_TYPE_MISMATCH",
  "RATE_PLAN_MISMATCH",
  "TAX_MISMATCH",
  "CANCELLATION_MISMATCH",
];

export interface CompareOptions {
  tolerance: ComparisonTolerance;
  /** When false, room type / rate plan differences are warnings, not mismatches. */
  matchRoomType?: boolean;
  matchRatePlan?: boolean;
  requireLra?: boolean;
  requireTaxesIncluded?: boolean;
  matchCancellation?: boolean;
  /** Minimum confidence for a deterministic cancellation verdict. */
  cancellationConfidenceThreshold?: number;
}

export function compareRateLoading(
  expected: ExpectedRateSnapshot,
  found: PortalRateOffer | null,
  options: CompareOptions,
): RateLoadingComparisonResult {
  const mismatches: Mismatch[] = [];
  const warnings: string[] = [];

  const expectedCurrency = normalizeCurrency(expected.currency);
  const expectedPerNight = toPerNight(expected.rate_amount, expected.rate_basis, expected.number_of_nights);

  const base = {
    expected,
    found,
    normalized_values: {
      expected_per_night: expectedPerNight,
      found_per_night: null as number | null,
      expected_currency: expectedCurrency,
      found_currency: null as string | null,
      absolute_difference: null as number | null,
      percentage_difference: null as number | null,
    },
  };

  if (!found || !found.hotel_found) {
    return {
      ...base,
      result_code: "HOTEL_NOT_FOUND",
      passed: false,
      confidence: 1,
      mismatches: [
        {
          field: "hotel",
          code: "HOTEL_NOT_FOUND",
          expected: expected.hotel_name,
          found: null,
          message: "Hotel não localizado no portal para as datas pesquisadas.",
        },
      ],
      warnings,
    };
  }

  if (!found.found || found.rate_amount === null || found.rate_amount === undefined) {
    return {
      ...base,
      result_code: "RATE_NOT_FOUND",
      passed: false,
      confidence: 1,
      mismatches: [
        {
          field: "rate",
          code: "RATE_NOT_FOUND",
          expected: expected.rate_amount,
          found: null,
          message: "Tarifa negociada não encontrada entre as ofertas disponíveis.",
        },
      ],
      warnings,
    };
  }

  const foundCurrency = normalizeCurrency(found.currency);
  const foundNights = found.number_of_nights ?? expected.number_of_nights;
  const foundPerNight = toPerNight(found.rate_amount, found.rate_basis ?? "per_night", foundNights);

  base.normalized_values.found_currency = foundCurrency;
  base.normalized_values.found_per_night = foundPerNight;

  // --- currency ---------------------------------------------------------
  if (expectedCurrency && foundCurrency && expectedCurrency !== foundCurrency) {
    mismatches.push({
      field: "currency",
      code: "CURRENCY_MISMATCH",
      expected: expectedCurrency,
      found: foundCurrency,
      message: `Moeda divergente: esperado ${expectedCurrency}, encontrado ${foundCurrency}.`,
    });
  } else if (!foundCurrency) {
    warnings.push("Moeda não identificada na oferta do portal.");
  }

  // --- rate value -------------------------------------------------------
  let rateWithinTolerance = false;
  let exact = false;
  if (expectedPerNight !== null && foundPerNight !== null) {
    const absDiff = Math.abs(foundPerNight - expectedPerNight);
    const pctDiff = expectedPerNight === 0 ? 0 : (absDiff / expectedPerNight) * 100;
    base.normalized_values.absolute_difference = round2(foundPerNight - expectedPerNight);
    base.normalized_values.percentage_difference = round2(
      expectedPerNight === 0 ? 0 : ((foundPerNight - expectedPerNight) / expectedPerNight) * 100,
    );
    exact = absDiff < 0.005;
    rateWithinTolerance =
      exact || absDiff <= (options.tolerance.amount ?? 0) || pctDiff <= (options.tolerance.percent ?? 0);
    if (!rateWithinTolerance) {
      mismatches.push({
        field: "rate",
        code: "RATE_VALUE_MISMATCH",
        expected: round2(expectedPerNight),
        found: round2(foundPerNight),
        message: `Tarifa divergente: esperado ${round2(expectedPerNight)}, encontrado ${round2(foundPerNight)} (${round2(pctDiff)}%).`,
      });
    }
  } else {
    warnings.push("Não foi possível normalizar a base tarifária para comparação.");
  }

  // --- room type / rate plan -------------------------------------------
  if (options.matchRoomType && expected.room_type) {
    if (!softTextMatch(expected.room_type, found.room_type)) {
      mismatches.push({
        field: "room_type",
        code: "ROOM_TYPE_MISMATCH",
        expected: expected.room_type,
        found: found.room_type ?? null,
        message: "Tipo de quarto divergente do contratado.",
      });
    }
  }
  if (options.matchRatePlan && expected.rate_plan) {
    if (!softTextMatch(expected.rate_plan, found.rate_plan)) {
      mismatches.push({
        field: "rate_plan",
        code: "RATE_PLAN_MISMATCH",
        expected: expected.rate_plan,
        found: found.rate_plan ?? null,
        message: "Plano tarifário divergente do contratado.",
      });
    }
  }
  if (expected.corporate_rate_code && found.rate_code) {
    if (expected.corporate_rate_code.trim().toUpperCase() !== found.rate_code.trim().toUpperCase()) {
      warnings.push(
        `Código corporativo divergente: esperado ${expected.corporate_rate_code}, encontrado ${found.rate_code}.`,
      );
    }
  }

  // --- amenities --------------------------------------------------------
  const foundAmenities = new Set(canonicalAmenities(found.amenities ?? []));
  if (found.raw_text) {
    for (const c of canonicalAmenities(found.raw_text.split(/[•,\n;|]/))) foundAmenities.add(c);
  }

  const mandatory = new Set(canonicalAmenities(expected.mandatory_amenities ?? []));
  if (expected.breakfast) mandatory.add("BREAKFAST");
  if (expected.wifi) mandatory.add("WIFI");
  if (expected.parking) mandatory.add("PARKING");

  for (const need of mandatory) {
    if (!foundAmenities.has(need)) {
      mismatches.push({
        field: `amenity:${need}`,
        code: need === "BREAKFAST" ? "BREAKFAST_MISMATCH" : "AMENITY_MISMATCH",
        expected: need,
        found: null,
        message: `Comodidade obrigatória ausente na oferta: ${need}.`,
      });
    }
  }
  // Extra amenities never fail a check.

  // --- LRA --------------------------------------------------------------
  if (options.requireLra && expected.lra !== null && expected.lra !== undefined) {
    if (found.lra === null || found.lra === undefined) {
      warnings.push("Portal não informou LRA de forma conclusiva — revisão manual necessária.");
      return manualReview(base, mismatches, warnings);
    }
    if (found.lra !== expected.lra) {
      mismatches.push({
        field: "lra",
        code: "LRA_MISMATCH",
        expected: expected.lra,
        found: found.lra,
        message: "Condição de LRA divergente do contratado.",
      });
    }
  }

  // --- taxes ------------------------------------------------------------
  if (options.requireTaxesIncluded && expected.taxes_included !== null && expected.taxes_included !== undefined) {
    if (found.taxes_included === null || found.taxes_included === undefined) {
      warnings.push("Portal não informou tratamento de impostos.");
    } else if (found.taxes_included !== expected.taxes_included) {
      mismatches.push({
        field: "taxes",
        code: "TAX_MISMATCH",
        expected: expected.taxes_included,
        found: found.taxes_included,
        message: "Tratamento de impostos divergente do contratado.",
      });
    }
  }

  // --- cancellation -----------------------------------------------------
  if (options.matchCancellation && (expected.cancellation_policy || expected.refundable !== null)) {
    const parsed = normalizeCancellation(found.cancellation_text);
    const threshold = options.cancellationConfidenceThreshold ?? 0.6;
    if (parsed.confidence < threshold) {
      warnings.push("Política de cancelamento não pôde ser interpretada com segurança.");
      return manualReview(base, mismatches, warnings);
    }
    if (
      expected.refundable !== null &&
      expected.refundable !== undefined &&
      parsed.refundable !== null &&
      parsed.refundable !== expected.refundable
    ) {
      mismatches.push({
        field: "cancellation",
        code: "CANCELLATION_MISMATCH",
        expected: expected.refundable ? "refundable" : "non_refundable",
        found: parsed.refundable ? "refundable" : "non_refundable",
        message: "Política de cancelamento divergente do contratado.",
      });
    } else if (
      expected.cancellation_hours !== null &&
      expected.cancellation_hours !== undefined &&
      parsed.free_cancel_hours !== null &&
      parsed.free_cancel_hours > expected.cancellation_hours
    ) {
      mismatches.push({
        field: "cancellation",
        code: "CANCELLATION_MISMATCH",
        expected: `${expected.cancellation_hours}h`,
        found: `${parsed.free_cancel_hours}h`,
        message: "Prazo de cancelamento gratuito pior que o contratado.",
      });
    }
  }

  // --- verdict ----------------------------------------------------------
  if (mismatches.length === 0) {
    return {
      ...base,
      result_code: exact ? "PASS_EXACT" : "PASS_WITH_TOLERANCE",
      passed: true,
      confidence: warnings.length === 0 ? 1 : 0.9,
      mismatches,
      warnings,
    };
  }

  const headline =
    MISMATCH_PRIORITY.find((code) => mismatches.some((m) => m.code === code)) ?? "LOADED_WITH_MISMATCH";

  return {
    ...base,
    result_code: headline,
    passed: false,
    confidence: 1,
    mismatches,
    warnings,
  };
}

function manualReview(
  base: Pick<RateLoadingComparisonResult, "expected" | "found" | "normalized_values">,
  mismatches: Mismatch[],
  warnings: string[],
): RateLoadingComparisonResult {
  return {
    ...base,
    result_code: "MANUAL_REVIEW",
    passed: false,
    confidence: 0.4,
    mismatches,
    warnings,
  };
}

function softTextMatch(expected: string, found: string | null | undefined): boolean {
  if (!found) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const a = norm(expected);
  const b = norm(found);
  if (!a || !b) return false;
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const ca = canonicalAmenity(expected);
  const cb = canonicalAmenity(found);
  return !!ca && ca === cb;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rate Loading compliance: passes over completed business checks only. */
export function computeCompliance(resultCodes: readonly (string | null | undefined)[]): {
  compliance: number;
  businessChecks: number;
  passes: number;
} {
  const technical = new Set(["LOGIN_FAILED", "PORTAL_ERROR", "AUTOMATION_ERROR"]);
  const business = resultCodes.filter((c): c is string => !!c && !technical.has(c));
  const passes = business.filter((c) => c === "PASS_EXACT" || c === "PASS_WITH_TOLERANCE").length;
  return {
    compliance: business.length === 0 ? 0 : (passes / business.length) * 100,
    businessChecks: business.length,
    passes,
  };
}
