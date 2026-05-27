import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bookingRowSchema = z.object({
  booking_id: z.string().optional().nullable(),
  hotel: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional().default(""),
  checkin: z.string().optional().nullable(),
  room_nights: z.number().min(0),
  adr: z.number().min(0),
  channel: z.string().optional().default("Direct"),
});

const contractRowSchema = z.object({
  hotel: z.string().min(1),
  negotiated_adr: z.number().min(0),
  cap: z.number().min(0),
  valid_until: z.string().optional().nullable(),
});

const uploadStatus = z.enum(["ok", "partial", "error"]);
const datasetType = z.enum(["bookings", "hotels", "contracts"]);

const ingestSchema = z.object({
  clientTenantId: z.string().uuid(),
  datasetType,
  filename: z.string().min(1).max(255),
  status: uploadStatus,
  rowCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  errors: z.array(z.string()).max(100).default([]),
  storagePath: z.string().max(500).optional().nullable(),
  bookings: z.array(bookingRowSchema).max(50000).optional(),
  contracts: z.array(contractRowSchema).max(50000).optional(),
});

export const ingestBaselineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ingestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Create the upload record
    const { data: upload, error: upErr } = await supabase
      .from("baseline_uploads")
      .insert({
        client_tenant_id: data.clientTenantId,
        dataset_type: data.datasetType,
        filename: data.filename,
        row_count: data.rowCount,
        error_count: data.errorCount,
        status: data.status,
        errors: data.errors as never,
        uploaded_by: userId,
      })
      .select("*")
      .single();
    if (upErr) throw new Error(upErr.message);

    // 2. Insert the rows linked to the upload
    if (data.datasetType === "bookings" && data.bookings && data.bookings.length > 0) {
      const rows = data.bookings.map((b) => ({
        client_tenant_id: data.clientTenantId,
        booking_external_id: b.booking_id ?? null,
        hotel_name: b.hotel,
        city: b.city,
        state: b.state || null,
        checkin: b.checkin || null,
        room_nights: b.room_nights,
        adr: b.adr,
        channel: b.channel || null,
        upload_id: upload.id,
        raw: b as never,
      }));
      // Chunk to avoid payload limits
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from("bookings").insert(rows.slice(i, i + CHUNK));
        if (error) throw new Error(`bookings insert chunk ${i}: ${error.message}`);
      }
    }

    if (data.datasetType === "contracts" && data.contracts && data.contracts.length > 0) {
      const rows = data.contracts.map((c) => ({
        client_tenant_id: data.clientTenantId,
        upload_id: upload.id,
        hotel_name: c.hotel,
        hotel_code: c.hotel,
        cap: c.cap,
        currency: "BRL",
        valid_until: c.valid_until || null,
        raw: c as never,
      }));
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from("baseline_contracts").insert(rows.slice(i, i + CHUNK));
        if (error) throw new Error(`contracts insert chunk ${i}: ${error.message}`);
      }
    }

    return { uploadId: upload.id };
  });

export const listUploadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientTenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("baseline_uploads")
      .select("*")
      .eq("client_tenant_id", data.clientTenantId)
      .order("uploaded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Cascade: delete child rows (no FK on bookings.upload_id), then upload
    await supabase.from("bookings").delete().eq("upload_id", data.id);
    await supabase.from("baseline_contracts").delete().eq("upload_id", data.id);
    const { error } = await supabase.from("baseline_uploads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface BookingRow {
  id: string;
  client_tenant_id: string;
  booking_external_id: string | null;
  hotel_name: string;
  city: string;
  state: string | null;
  checkin: string | null;
  room_nights: number;
  adr: number;
  channel: string | null;
  upload_id: string | null;
}

export const listBookingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientTenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<BookingRow[]> => {
    const { supabase } = context;
    const all: BookingRow[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("bookings")
        .select("id, client_tenant_id, booking_external_id, hotel_name, city, state, checkin, room_nights, adr, channel, upload_id")
        .eq("client_tenant_id", data.clientTenantId)
        .order("checkin", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      all.push(...(rows as BookingRow[]));
      if (rows.length < PAGE) break;
    }
    return all;
  });

export const listContractsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientTenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("baseline_contracts")
      .select("*")
      .eq("client_tenant_id", data.clientTenantId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
