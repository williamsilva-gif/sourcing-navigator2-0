import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const kindSchema = z.enum(["renegotiation", "cap_adjustment", "cluster_change", "mini_rfp", "communication"]);
const statusSchema = z.enum(["initiated", "in_progress", "completed"]);
const effortSchema = z.enum(["low", "medium", "high"]);

const createSchema = z.object({
  id: z.string().uuid().optional(),
  clientTenantId: z.string().uuid(),
  opportunityId: z.string().max(200).optional().nullable(),
  label: z.string().min(1).max(200),
  kind: kindSchema,
  module: z.string().min(1).max(50),
  city: z.string().max(100).optional().nullable(),
  effort: effortSchema,
  status: statusSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
  kpis: z.record(z.string(), z.unknown()),
});


export const createActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const insertRow: Record<string, unknown> = {
      client_tenant_id: data.clientTenantId,
      opportunity_id: data.opportunityId ?? null,
      label: data.label,
      kind: data.kind,
      module: data.module,
      city: data.city ?? null,
      status: data.status ?? "initiated",
      effort: data.effort,
      payload: data.payload,
      kpis: data.kpis,
      created_by: userId,
    };
    if (data.id) insertRow.id = data.id;
    const { data: row, error } = await supabase
      .from("client_actions")
      .insert(insertRow as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_actions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const updateActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: statusSchema.optional(),
        kpis: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { status?: "initiated" | "in_progress" | "completed"; kpis?: never } = {};
    if (data.status) patch.status = data.status;
    if (data.kpis) patch.kpis = data.kpis as never;
    const { error } = await supabase.from("client_actions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listActionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientTenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("client_actions")
      .select("*")
      .eq("client_tenant_id", data.clientTenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
