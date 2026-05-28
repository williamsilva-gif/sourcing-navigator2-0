import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        let dbOk = false;
        let authOk = false;
        let error: string | null = null;

        try {
          // Ping leve no Postgres via supabaseAdmin
          const { data, error: dbError } = await supabaseAdmin
            .from("client_tenants")
            .select("id", { count: "exact", head: true });

          if (dbError) throw dbError;
          dbOk = true;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        try {
          // Verificar se o auth está respondendo (service role pode checar settings)
          const { error: authError } = await supabaseAdmin.auth.getSession();
          // getSession com service role retorna erro esperado, mas se não crashou, auth está up
          authOk = authError?.message !== "Service role cannot retrieve user sessions" 
            ? !authError 
            : true; // O erro específico significa que o serviço está respondendo
        } catch (e) {
          // Auth service down
          authOk = false;
        }

        const responseTimeMs = Date.now() - startedAt;
        const version = process.env.VITE_APP_VERSION || "dev";
        const timestamp = new Date().toISOString();

        const healthy = dbOk && authOk;

        return new Response(
          JSON.stringify({
            status: healthy ? "healthy" : "degraded",
            db: dbOk ? "ok" : "error",
            auth: authOk ? "ok" : "error",
            response_time_ms: responseTimeMs,
            version,
            timestamp,
            ...(error ? { error } : {}),
          }),
          {
            status: healthy ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, max-age=0",
            },
          }
        );
      },
    },
  },
});
