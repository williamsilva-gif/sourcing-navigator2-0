// Rate Loading Check — shared domain types.
// Used by the app (server functions + UI) and by the external Playwright worker.

export type RateBasis = "per_night" | "total_stay";

export type ResultCode =
  | "PASS_EXACT"
  | "PASS_WITH_TOLERANCE"
  | "LOADED_WITH_MISMATCH"
  | "RATE_NOT_FOUND"
  | "HOTEL_NOT_FOUND"
  | "RATE_VALUE_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "ROOM_TYPE_MISMATCH"
  | "RATE_PLAN_MISMATCH"
  | "AMENITY_MISMATCH"
  | "BREAKFAST_MISMATCH"
  | "TAX_MISMATCH"
  | "CANCELLATION_MISMATCH"
  | "LRA_MISMATCH"
  | "LOGIN_FAILED"
  | "PORTAL_ERROR"
  | "AUTOMATION_ERROR"
  | "NEEDS_HUMAN_ACTION"
  | "MANUAL_REVIEW";

export type TechnicalErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_MFA_REQUIRED"
  | "AUTH_CAPTCHA"
  | "AUTH_ACCESS_DENIED"
  | "PORTAL_TIMEOUT"
  | "PORTAL_UNAVAILABLE"
  | "PORTAL_LAYOUT_CHANGED"
  | "HOTEL_NOT_FOUND"
  | "RATE_NOT_FOUND"
  | "WORKER_TIMEOUT"
  | "WORKER_BROWSER_CRASH"
  | "WORKER_EXTRACTION_FAILED"
  | "EVIDENCE_CAPTURE_FAILED"
  | "EVIDENCE_UPLOAD_FAILED"
  | "QUOTA_EXCEEDED"
  | "JOB_DUPLICATE"
  | "JOB_LEASE_EXPIRED"
  | "UNKNOWN_ERROR";

/** Business result codes that consume a billable unit once a real search happened. */
export const BILLABLE_RESULT_CODES: ResultCode[] = [
  "PASS_EXACT",
  "PASS_WITH_TOLERANCE",
  "LOADED_WITH_MISMATCH",
  "RATE_NOT_FOUND",
  "HOTEL_NOT_FOUND",
  "MANUAL_REVIEW",
  "RATE_VALUE_MISMATCH",
  "CURRENCY_MISMATCH",
  "ROOM_TYPE_MISMATCH",
  "RATE_PLAN_MISMATCH",
  "AMENITY_MISMATCH",
  "BREAKFAST_MISMATCH",
  "TAX_MISMATCH",
  "CANCELLATION_MISMATCH",
  "LRA_MISMATCH",
];

/** Technical outcomes excluded from the compliance denominator. */
export const TECHNICAL_RESULT_CODES: ResultCode[] = [
  "LOGIN_FAILED",
  "PORTAL_ERROR",
  "AUTOMATION_ERROR",
];

/** Errors that may be retried automatically. */
export const RETRYABLE_ERROR_CODES: TechnicalErrorCode[] = [
  "PORTAL_TIMEOUT",
  "PORTAL_UNAVAILABLE",
  "WORKER_TIMEOUT",
  "WORKER_BROWSER_CRASH",
];

export interface ExpectedRateSnapshot {
  hotel_id?: string | null;
  hotel_name: string;
  city?: string | null;
  rfp_id?: string | null;
  awarded_program_id?: string | null;
  final_agreed_terms_id?: string | null;
  currency: string;
  rate_amount: number | null;
  rate_basis: RateBasis;
  room_type?: string | null;
  rate_plan?: string | null;
  corporate_rate_code?: string | null;
  occupancy: { rooms: number; adults: number; children: number };
  check_in: string;
  check_out: string;
  number_of_nights: number;
  valid_from?: string | null;
  valid_to?: string | null;
  lra?: boolean | null;
  breakfast?: boolean | null;
  wifi?: boolean | null;
  parking?: boolean | null;
  taxes_included?: boolean | null;
  service_charge_pct?: number | null;
  cancellation_policy?: string | null;
  cancellation_hours?: number | null;
  refundable?: boolean | null;
  mandatory_amenities: string[];
  optional_amenities: string[];
  inclusions?: Record<string, unknown>;
}

export interface PortalRateOffer {
  hotel_name?: string | null;
  found: boolean;
  hotel_found: boolean;
  currency?: string | null;
  rate_amount?: number | null;
  rate_basis?: RateBasis | null;
  number_of_nights?: number | null;
  room_type?: string | null;
  rate_plan?: string | null;
  rate_code?: string | null;
  lra?: boolean | null;
  refundable?: boolean | null;
  taxes_included?: boolean | null;
  cancellation_text?: string | null;
  amenities: string[];
  raw_text?: string | null;
  page_url?: string | null;
}

export interface Mismatch {
  field: string;
  code: ResultCode;
  expected: unknown;
  found: unknown;
  message: string;
}

export interface ComparisonTolerance {
  amount: number;
  percent: number;
}

export interface RateLoadingComparisonResult {
  result_code: ResultCode;
  passed: boolean;
  confidence: number;
  expected: ExpectedRateSnapshot;
  found: PortalRateOffer | null;
  normalized_values: {
    expected_per_night: number | null;
    found_per_night: number | null;
    expected_currency: string | null;
    found_currency: string | null;
    absolute_difference: number | null;
    percentage_difference: number | null;
  };
  mismatches: Mismatch[];
  warnings: string[];
}
