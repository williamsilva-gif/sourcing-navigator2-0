import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hotelSchema } from "./baselineSchemas";

const bulkHotelsSchema = z.object({
  hotels: z.array(hotelSchema).min(1).max(1000),
});

export const bulkUpsertHotelsByCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkHotelsSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ added: number; updated: number; failed: number; firstError?: string }> => {
    const toDb = (h: (typeof data.hotels)[number]) => ({
      code: h.code || null,
      name: h.name,
      address: h.address || null,
      postal_code: h.postal_code || null,
      city: h.city,
      state: h.state_province || null,
      country_code: h.country_code || null,
      phone: h.phone_number || null,
      contact_name: h.Contact || null,
      contact_email: null,
      latitude: typeof h.latitude === "number" ? h.latitude : null,
      longitude: typeof h.longitude === "number" ? h.longitude : null,
      star_rating: typeof h.star_rating === "number" ? h.star_rating : null,
      metadata: h.category_id ? { category_id: h.category_id } : {},
    });
    const hotels = data.hotels;
    const codes = hotels.map((h) => h.code).filter((c): c is string => Boolean(c));
    let existing: { id: string; code: string | null }[] = [];

    if (codes.length > 0) {
      const { data: rows, error } = await context.supabase.from("hotels").select("id, code").in("code", codes);
      if (error) throw error;
      existing = (rows ?? []) as { id: string; code: string | null }[];
    }

    const existingByCode = new Map(existing.filter((e) => e.code).map((e) => [e.code as string, e.id]));
    let added = 0;
    let updated = 0;
    let failed = 0;
    let firstError: string | undefined;

    const toInsert = hotels.filter((h) => !h.code || !existingByCode.has(h.code)).map(toDb);
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const { error, count } = await context.supabase.from("hotels").insert(batch, { count: "exact" });
      if (error) {
        failed += batch.length;
        firstError ??= error.message;
      } else {
        added += count ?? batch.length;
      }
    }

    for (const h of hotels) {
      if (!h.code || !existingByCode.has(h.code)) continue;
      const id = existingByCode.get(h.code)!;
      const { error } = await context.supabase.from("hotels").update(toDb(h)).eq("id", id);
      if (error) {
        failed++;
        firstError ??= error.message;
      } else {
        updated++;
      }
    }

    return { added, updated, failed, firstError };
  });