import { supabase } from "@/integrations/supabase/client";
import type { Hotel } from "./baselineSchemas";
import { bulkUpsertHotelsByCodeFn } from "./hotels.functions";

// DB row shape — matches the `hotels` table in Supabase.
export interface HotelRow {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string;
  state: string | null;
  country_code: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  metadata: Record<string, unknown>;
  tenant_id_owner: string | null;
  created_at: string;
  updated_at: string;
}

// Hydrated row used by the UI — DB row + the legacy zod fields the form expects.
export interface HotelWithLocal extends HotelRow {
  state_province: string;
  phone_number: string;
  Contact: string;
  category_id: string;
}

function fromDb(row: HotelRow): HotelWithLocal {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    ...row,
    state_province: row.state ?? "",
    phone_number: row.phone ?? "",
    Contact: row.contact_name ?? row.contact_email ?? "",
    category_id: typeof meta.category_id === "string" ? (meta.category_id as string) : "",
  };
}

function toDb(h: Hotel) {
  return {
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
    metadata: (h.category_id ? { category_id: h.category_id } : {}) as never,
  };
}

export async function listHotels(): Promise<HotelWithLocal[]> {
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data as HotelRow[]).map(fromDb);
}

export async function createHotel(h: Hotel): Promise<HotelWithLocal> {
  const { data, error } = await supabase.from("hotels").insert(toDb(h)).select().single();
  if (error) throw error;
  return fromDb(data as HotelRow);
}

export async function updateHotel(id: string, h: Hotel): Promise<HotelWithLocal> {
  const { data, error } = await supabase.from("hotels").update(toDb(h)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(data as HotelRow);
}

export async function deleteHotelById(id: string): Promise<void> {
  const { error } = await supabase.from("hotels").delete().eq("id", id);
  if (error) throw error;
}

// Bulk upsert by `code` (natural key). Falls back to insert when code is empty.
// Returns count of inserts vs updates so the UI can confirm what happened.
export async function bulkUpsertByCode(
  hotels: Hotel[],
  onProgress?: (info: { processed: number; total: number; batch: number; batches: number }) => void,
): Promise<{ added: number; updated: number; failed: number; firstError?: string }> {
  if (hotels.length === 0) return { added: 0, updated: 0, failed: 0 };

  // Split into exactly 4 batches, capped at 5000/batch (server limit).
  const batches = 4;
  const BATCH_SIZE = Math.min(5000, Math.ceil(hotels.length / batches));
  let added = 0;
  let updated = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (let i = 0; i < batches; i++) {
    const chunk = hotels.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    try {
      const res = await bulkUpsertHotelsByCodeFn({ data: { hotels: chunk } });
      added += res.added ?? 0;
      updated += res.updated ?? 0;
      failed += res.failed ?? 0;
      if (!firstError && res.firstError) firstError = res.firstError;
    } catch (e) {
      failed += chunk.length;
      if (!firstError) firstError = e instanceof Error ? e.message : String(e);
    }
    onProgress?.({ processed: Math.min((i + 1) * BATCH_SIZE, hotels.length), total: hotels.length, batch: i + 1, batches });
  }

  return { added, updated, failed, firstError };
}
