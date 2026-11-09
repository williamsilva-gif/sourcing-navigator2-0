import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const scope = z.object({ tenantId: z.string().uuid(), jobId: z.string().uuid().optional() });
// Read-only by design: do not use getSheetJob's paused snapshot normalization.
export const crossingSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const access = await context.supabase.rpc("proximity_access", { _tenant_id: data.tenantId });
    if (access.error || !access.data) throw new Error("Acesso restrito à TA neste cliente.");
    if (data.jobId) {
      const r = await context.supabase
        .from("sheet_geolocation_jobs")
        .select("id,filename,kind,status,checkpoint,rows,created_at")
        .eq("client_tenant_id", data.tenantId)
        .eq("id", data.jobId)
        .eq("status", "processed")
        .in("kind", ["hotel", "office"])
        .single();
      if (r.error) throw new Error("Arquivo concluído indisponível neste cliente.");
      return { job: r.data, jobs: [] };
    }
    const r = await context.supabase
      .from("sheet_geolocation_jobs")
      .select("id,filename,kind,status,checkpoint,created_at")
      .eq("client_tenant_id", data.tenantId)
      .eq("status", "processed")
      .in("kind", ["hotel", "office"])
      .order("created_at", { ascending: false });
    if (r.error) throw new Error("Não foi possível listar os arquivos concluídos.");
    return { job: null, jobs: r.data };
  });
