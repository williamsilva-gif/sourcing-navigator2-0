import { z } from "zod";

// Permissive but typed schemas — coerce numbers/dates to allow Excel inputs.
export const bookingSchema = z.object({
  booking_id: z.union([z.string(), z.number()]).transform(String),
  hotel: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional().default(""),
  checkin: z.union([z.string(), z.number(), z.date()]).transform((v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") {
      // Excel serial date
      const date = new Date(Math.round((v - 25569) * 86400 * 1000));
      return date.toISOString().slice(0, 10);
    }
    return String(v);
  }),
  room_nights: z.coerce.number().min(0),
  adr: z.coerce.number().min(0),
  channel: z.string().optional().default("Direct"),
});

// Some property-list exports drop the decimal point in coordinates
// (e.g. -2917487 instead of -29.17487). Auto-rescale until value falls in range.
function normalizeCoord(max: number) {
  return (v: unknown) => {
    if (v === null || v === undefined || v === "") return undefined;
    let n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return undefined;
    let abs = Math.abs(n);
    let guard = 0;
    while (abs > max && guard < 20) {
      n = n / 10;
      abs = Math.abs(n);
      guard++;
    }
    return n;
  };
}

export const hotelSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  address: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
  postal_code: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
  city: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1)),
  state_province: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
  country_code: z.preprocess((v) => (v == null ? "" : String(v).toUpperCase()), z.string().default("")),
  phone_number: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
  Contact: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
  latitude: z.preprocess(normalizeCoord(90), z.number().min(-90).max(90).optional()),
  longitude: z.preprocess(normalizeCoord(180), z.number().min(-180).max(180).optional()),
  star_rating: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : Number(v)),
    z.number().min(0).max(5).optional(),
  ),
  category_id: z.preprocess((v) => (v == null ? "" : String(v)), z.string().default("")),
});

export const contractSchema = z.object({
  hotel: z.string().min(1),
  negotiated_adr: z.coerce.number().min(0),
  cap: z.coerce.number().min(0),
  valid_until: z.union([z.string(), z.number(), z.date()]).transform((v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") {
      const date = new Date(Math.round((v - 25569) * 86400 * 1000));
      return date.toISOString().slice(0, 10);
    }
    return String(v);
  }),
});

export type Booking = z.infer<typeof bookingSchema>;
export type Hotel = z.infer<typeof hotelSchema>;
export type Contract = z.infer<typeof contractSchema>;

export type DatasetType = "bookings" | "hotels" | "contracts";

export const SCHEMA_HEADERS: Record<DatasetType, string[]> = {
  bookings: ["booking_id", "hotel", "city", "state", "checkin", "room_nights", "adr", "channel"],
  hotels: ["code", "name", "address", "postal_code", "city", "state_province", "country_code", "phone_number", "Contact", "latitude", "longitude", "star_rating", "category_id"],
  contracts: ["hotel", "negotiated_adr", "cap", "valid_until"],
};

export const SCHEMA_LABELS: Record<DatasetType, string> = {
  bookings: "Bookings (transações)",
  hotels: "Hotéis cadastrados",
  contracts: "Contratos vigentes",
};