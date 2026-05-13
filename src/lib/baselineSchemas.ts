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

export const hotelSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  address: z.string().optional().default(""),
  postal_code: z.union([z.string(), z.number()]).transform(String).optional().default(""),
  city: z.string().min(1),
  state_province: z.string().optional().default(""),
  country_code: z.string().optional().default(""),
  phone_number: z.union([z.string(), z.number()]).transform(String).optional().default(""),
  Contact: z.string().optional().default(""),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  star_rating: z.coerce.number().min(0).max(5).optional(),
  category_id: z.union([z.string(), z.number()]).transform(String).optional().default(""),
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