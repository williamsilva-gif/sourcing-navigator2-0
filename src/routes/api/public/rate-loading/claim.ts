// Worker queue endpoint: claim the next Rate Loading job.
// Authenticated by a shared worker token; never reachable from the browser UI.
import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/rate-loading/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-worker-token") ?? "";
        const expected = process.env["RATE_LOADING_WORKER_TOKEN"] ?? "";
        if (!expected || token.length !== expected.length || token !== expected) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as {
          workerId?: string;
          leaseSeconds?: number;
        };
        const workerId = (body.workerId ?? "worker").slice(0, 64);
        const leaseSeconds = Math.min(Math.max(body.leaseSeconds ?? 300, 60), 1800);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: jobs, error } = await supabaseAdmin.rpc("claim_rate_loading_job", {
          _worker_id: workerId,
          _lease_seconds: leaseSeconds,
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job) return new Response(JSON.stringify({ job: null }), { headers: { "content-type": "application/json" } });

        const [checkRes, connRes] = await Promise.all([
          supabaseAdmin.from("rate_loading_checks").select("*").eq("id", job.check_id).single(),
          job.portal_connection_id
            ? supabaseAdmin
                .from("rate_loading_portal_connections")
                .select("*")
                .eq("id", job.portal_connection_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const check = checkRes.data;
        const conn = connRes.data;
        if (!check || !conn) {
          await supabaseAdmin
            .from("rate_loading_jobs")
            .update({ status: "failed", last_error: "missing_check_or_connection", finished_at: new Date().toISOString() })
            .eq("id", job.id);
          return new Response(JSON.stringify({ job: null }), { headers: { "content-type": "application/json" } });
        }

        // Resolve credentials server-side; they exist only in this response body,
        // over TLS, to the authenticated worker.
        let credential: { username: string; password: string } | null = null;
        if (conn.credential_secret_ref) {
          const { data: cred } = await supabaseAdmin
            .from("rate_loading_portal_credentials")
            .select("ciphertext")
            .eq("secret_ref", conn.credential_secret_ref)
            .maybeSingle();
          if (cred?.ciphertext) {
            const { decryptCredential } = await import("@/lib/rateLoading/credentialCrypto.server");
            credential = decryptCredential(cred.ciphertext);
          }
        }

        const attemptNumber = (job.attempts ?? 1) as number;

        return new Response(
          JSON.stringify({
            job: {
              id: job.id,
              tenantId: job.client_tenant_id,
              campaignId: job.campaign_id,
              checkId: job.check_id,
              attemptNumber,
              leaseExpiresAt: job.lease_expires_at,
              idempotencyKey: job.idempotency_key,
            },
            connection: {
              id: conn.id,
              adapterKey: conn.portal_adapter_key,
              adapterVersion: conn.adapter_version,
              baseUrl: conn.base_url,
              authType: conn.auth_type,
              mfaMode: conn.mfa_mode,
              credential,
            },
            check: {
              id: check.id,
              hotelName: check.hotel_name,
              city: check.city,
              checkIn: check.check_in,
              checkOut: check.check_out,
              nights: check.number_of_nights,
              rooms: check.rooms,
              adults: check.adults,
              children: check.children,
              expectedSnapshot: check.expected_snapshot,
              expectedSnapshotHash: check.expected_snapshot_hash,
              toleranceAmount: check.rate_tolerance_amount,
              tolerancePercent: check.rate_tolerance_percent,
            },
          }),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
      },
    },
  },
});
