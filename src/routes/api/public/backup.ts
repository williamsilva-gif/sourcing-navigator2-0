import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// Tables to back up (ordered by dependency — parents first)
const TABLES = [
  "client_tenants",
  "client_actions",
  "baseline_uploads",
  "baseline_contracts",
  "bookings",
  "rfps",
  "rfp_invitations",
  "rfp_responses",
  "hotels",
  "user_roles",
  "profiles",
] as const;

const BACKUP_SECRET = process.env.BACKUP_SECRET;

export const Route = createFileRoute("/api/public/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Validate secret
        const authHeader = request.headers.get("authorization");
        const expected = BACKUP_SECRET ? `Bearer ${BACKUP_SECRET}` : "";
        if (!BACKUP_SECRET || authHeader !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const startedAt = new Date().toISOString();
        const dateStr = startedAt.split("T")[0];
        const results: Record<string, { rows: number; path: string }> = {};

        try {
          for (const table of TABLES) {
            // Stream all rows from table
            const { data: rows, error } = await supabaseAdmin
              .from(table as never)
              .select("*")
              .limit(1000); // Safety limit per table

            if (error) throw error;

            const json = JSON.stringify(rows ?? [], null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const path = `backups/${dateStr}/${table}.json`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from("baseline-files")
              .upload(path, blob, {
                contentType: "application/json",
                upsert: true,
              });

            if (uploadError) throw uploadError;

            results[table] = { rows: rows?.length ?? 0, path };
          }

          return new Response(
            JSON.stringify({
              status: "success",
              started_at: startedAt,
              tables_backed_up: Object.keys(results).length,
              details: results,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return new Response(
            JSON.stringify({
              status: "error",
              error: message,
              started_at: startedAt,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
