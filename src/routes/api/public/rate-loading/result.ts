// Worker result endpoint. The comparison itself runs HERE (server-side, deterministic),
// so the worker cannot influence pass/fail. The worker only reports what it observed.
import { createFileRoute } from "@tanstack/react-router";
import { compareRateLoading } from "@/lib/rateLoading/comparator";
import { sha256Hex } from "@/lib/rateLoading/snapshot";
import {
  BILLABLE_RESULT_CODES,
  RETRYABLE_ERROR_CODES,
  type ExpectedRateSnapshot,
  type PortalRateOffer,
  type TechnicalErrorCode,
} from "@/lib/rateLoading/types";

interface EvidencePayload {
  type: "result_screenshot" | "full_page_screenshot" | "error_screenshot" | "structured_result";
  contentBase64: string;
  contentType?: string;
  pageUrl?: string;
  viewport?: string;
}

interface ResultBody {
  jobId: string;
  workerId?: string;
  correlationId?: string;
  loginStatus?: "success" | "failed" | "mfa_required" | "skipped";
  searchStatus?: "success" | "not_found" | "error";
  offer?: PortalRateOffer | null;
  errorCode?: TechnicalErrorCode | null;
  errorMessage?: string | null;
  pageUrl?: string | null;
  durationMs?: number;
  evidence?: EvidencePayload[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Strip anything that could carry credentials out of a worker-supplied message. */
function sanitize(msg: string | null | undefined): string | null {
  if (!msg) return null;
  return msg
    .replace(/(password|senha|pwd|token|authorization|cookie)\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .slice(0, 500);
}

export const Route = createFileRoute("/api/public/rate-loading/result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-worker-token") ?? "";
        const expected = process.env["RATE_LOADING_WORKER_TOKEN"] ?? "";
        if (!expected || token !== expected) return json({ error: "unauthorized" }, 401);

        const body = (await request.json().catch(() => null)) as ResultBody | null;
        if (!body?.jobId) return json({ error: "jobId required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: job } = await supabaseAdmin
          .from("rate_loading_jobs")
          .select("*")
          .eq("id", body.jobId)
          .maybeSingle();
        if (!job) return json({ error: "job not found" }, 404);
        if (job.status === "completed") return json({ ok: true, duplicate: true });

        const { data: check } = await supabaseAdmin
          .from("rate_loading_checks")
          .select("*")
          .eq("id", job.check_id)
          .single();
        if (!check) return json({ error: "check not found" }, 404);

        const { data: campaign } = await supabaseAdmin
          .from("rate_loading_campaigns")
          .select("validation_rules, portal_connection_id")
          .eq("id", job.campaign_id)
          .maybeSingle();
        const rules = (campaign?.validation_rules ?? {}) as Record<string, unknown>;
        const { data: conn } = campaign?.portal_connection_id
          ? await supabaseAdmin
              .from("rate_loading_portal_connections")
              .select("portal_adapter_key, adapter_version")
              .eq("id", campaign.portal_connection_id)
              .maybeSingle()
          : { data: null };

        const attemptNumber = job.attempts ?? 1;
        const now = new Date().toISOString();

        // ---- deterministic evaluation -------------------------------------
        let resultCode: string;
        let summary: string;
        let mismatches: unknown[] = [];
        let warnings: unknown[] = [];
        let comparison: unknown = null;

        if (body.errorCode) {
          resultCode =
            body.errorCode === "LOGIN_FAILED" || body.errorCode === "MFA_REQUIRED"
              ? "LOGIN_FAILED"
              : body.errorCode === "PORTAL_UNAVAILABLE" || body.errorCode === "PORTAL_LAYOUT_CHANGED"
                ? "PORTAL_ERROR"
                : "AUTOMATION_ERROR";
          summary = `Falha técnica: ${body.errorCode}`;
        } else {
          const snapshot = check.expected_snapshot as unknown as ExpectedRateSnapshot;
          const result = compareRateLoading(snapshot, body.offer ?? null, {
            tolerance: {
              amount: Number(check.rate_tolerance_amount ?? 0),
              percent: Number(check.rate_tolerance_percent ?? 0),
            },
            matchRoomType: rules["matchRoomType"] !== false,
            matchRatePlan: rules["matchRatePlan"] !== false,
            requireLra: rules["requireLra"] === true,
            requireTaxesIncluded: rules["requireTaxesIncluded"] === true,
            matchCancellation: rules["matchCancellation"] !== false,
          });
          resultCode = result.result_code;
          mismatches = result.mismatches;
          warnings = result.warnings;
          comparison = result;
          summary = result.passed
            ? "Tarifa carregada conforme o acordo."
            : result.mismatches[0]?.message ?? "Divergência identificada.";
        }

        const billable = BILLABLE_RESULT_CODES.includes(resultCode as never);
        const retryable =
          !billable &&
          body.errorCode != null &&
          RETRYABLE_ERROR_CODES.includes(body.errorCode) &&
          attemptNumber < (job.max_attempts ?? 3);

        // ---- attempt -------------------------------------------------------
        const { data: attempt, error: attErr } = await supabaseAdmin
          .from("rate_loading_attempts")
          .insert({
            client_tenant_id: job.client_tenant_id,
            check_id: job.check_id,
            attempt_number: attemptNumber,
            job_id: job.id,
            status: body.errorCode ? "failed" : "completed",
            worker_id: (body.workerId ?? "worker").slice(0, 64),
            correlation_id: body.correlationId ?? job.idempotency_key,
            portal_adapter_key: conn?.portal_adapter_key ?? null,
            adapter_version: conn?.adapter_version ?? null,
            started_at: job.started_at,
            finished_at: now,
            login_status: body.loginStatus ?? null,
            search_status: body.searchStatus ?? null,
            found_offer: (body.offer ?? null) as never,
            result_code: resultCode,
            result_summary: summary,
            mismatches: mismatches as never,
            warnings: warnings as never,
            error_code: body.errorCode ?? null,
            error_message_sanitized: sanitize(body.errorMessage),
            page_url: body.pageUrl ?? null,
            duration_ms: body.durationMs ?? null,
          })
          .select("id")
          .single();
        if (attErr) return json({ error: attErr.message }, 500);

        // ---- evidence ------------------------------------------------------
        for (const ev of body.evidence ?? []) {
          try {
            const bytes = Buffer.from(ev.contentBase64, "base64");
            if (bytes.byteLength > 8 * 1024 * 1024) continue;
            const ext = ev.type === "structured_result" ? "json" : "png";
            const path = `${job.client_tenant_id}/${job.campaign_id}/${job.check_id}/${attempt.id}-${ev.type}.${ext}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("rate-loading-evidence")
              .upload(path, bytes, {
                contentType: ev.contentType ?? (ext === "json" ? "application/json" : "image/png"),
                upsert: true,
              });
            if (upErr) continue;
            await supabaseAdmin.from("rate_loading_evidence").insert({
              client_tenant_id: job.client_tenant_id,
              campaign_id: job.campaign_id,
              check_id: job.check_id,
              attempt_id: attempt.id,
              evidence_type: ev.type,
              storage_path: path,
              sha256: await sha256Hex(bytes.toString("base64")),
              page_url: ev.pageUrl ?? body.pageUrl ?? null,
              viewport: ev.viewport ?? null,
              retention_policy_days: 365,
            });
          } catch {
            // evidence is best-effort; the check result stands on its own
          }
        }

        // Store the full comparison report as structured evidence.
        if (comparison) {
          const path = `${job.client_tenant_id}/${job.campaign_id}/${job.check_id}/${attempt.id}-comparison.json`;
          const payload = JSON.stringify(comparison, null, 2);
          const { error: upErr } = await supabaseAdmin.storage
            .from("rate-loading-evidence")
            .upload(path, Buffer.from(payload), { contentType: "application/json", upsert: true });
          if (!upErr) {
            await supabaseAdmin.from("rate_loading_evidence").insert({
              client_tenant_id: job.client_tenant_id,
              campaign_id: job.campaign_id,
              check_id: job.check_id,
              attempt_id: attempt.id,
              evidence_type: "comparison_report",
              storage_path: path,
              sha256: await sha256Hex(payload),
              retention_policy_days: 365,
            });
          }
        }

        // ---- job + check state ---------------------------------------------
        if (retryable) {
          const backoffMinutes = Math.min(2 ** attemptNumber, 30);
          await supabaseAdmin
            .from("rate_loading_jobs")
            .update({
              status: "pending",
              locked_at: null,
              locked_by: null,
              lease_expires_at: null,
              available_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
              last_error: body.errorCode,
            })
            .eq("id", job.id);
          await supabaseAdmin
            .from("rate_loading_checks")
            .update({ status: "running", latest_attempt_id: attempt.id })
            .eq("id", job.check_id);
          return json({ ok: true, retryScheduled: true, resultCode });
        }

        await supabaseAdmin
          .from("rate_loading_jobs")
          .update({ status: body.errorCode ? "failed" : "completed", finished_at: now, last_error: body.errorCode ?? null })
          .eq("id", job.id);

        await supabaseAdmin
          .from("rate_loading_checks")
          .update({
            status: "completed",
            latest_attempt_id: attempt.id,
            latest_result_code: resultCode,
            last_checked_at: now,
          })
          .eq("id", job.check_id);

        // ---- usage ledger ----------------------------------------------------
        const { data: ent } = await supabaseAdmin
          .from("feature_entitlements")
          .select("quota_period")
          .eq("client_tenant_id", job.client_tenant_id)
          .eq("feature_key", "RATE_LOADING")
          .maybeSingle();
        const period = ent?.quota_period ?? "monthly";
        const d = new Date();
        const periodKey =
          period === "annual"
            ? `${d.getUTCFullYear()}`
            : period === "contract"
              ? "contract"
              : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

        await supabaseAdmin.rpc("finalize_feature_usage", {
          _tenant_id: job.client_tenant_id,
          _feature_key: "RATE_LOADING",
          _period_key: periodKey,
          _campaign_id: job.campaign_id,
          _check_id: job.check_id,
          _attempt_id: attempt.id,
          _billable: billable,
          _reason: billable ? "check_completed" : `non_billable_${body.errorCode ?? "error"}`,
        });

        // ---- campaign completion --------------------------------------------
        const { count: openJobs } = await supabaseAdmin
          .from("rate_loading_jobs")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", job.campaign_id)
          .in("status", ["pending", "processing"]);
        if ((openJobs ?? 0) === 0) {
          await supabaseAdmin
            .from("rate_loading_campaigns")
            .update({ status: "completed", finished_at: now })
            .eq("id", job.campaign_id);
        } else {
          await supabaseAdmin
            .from("rate_loading_campaigns")
            .update({ status: "running" })
            .eq("id", job.campaign_id);
        }

        return json({ ok: true, resultCode, billable });
      },
    },
  },
});
