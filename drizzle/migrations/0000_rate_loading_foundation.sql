-- ============================================================
-- RATE LOADING CHECK — foundation schema
-- Additive only. Multi-tenant via can_see_tenant()/is_ta_master().
-- ============================================================

-- Optional link from awarded program row to hotels registry (nullable, additive)
ALTER TABLE public.awarded_program ADD COLUMN IF NOT EXISTS hotel_id uuid;

-- ------------------------------------------------------------
-- 1. FINAL AGREED TERMS (source of truth for expected snapshot)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.final_agreed_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  awarded_program_id uuid REFERENCES public.awarded_program(id) ON DELETE CASCADE,
  rfp_id uuid REFERENCES public.rfps(id),
  negotiation_thread_id uuid REFERENCES public.negotiation_threads(id),
  hotel_id uuid REFERENCES public.hotels(id),
  hotel_name text NOT NULL,
  city text,
  currency text NOT NULL DEFAULT 'BRL',
  single_rate numeric,
  double_rate numeric,
  rate_basis text NOT NULL DEFAULT 'per_night',
  room_type text,
  rate_plan text,
  corporate_rate_code text,
  valid_from date,
  valid_to date,
  lra boolean,
  breakfast boolean,
  wifi boolean,
  parking boolean,
  taxes_included boolean,
  service_charge_pct numeric,
  cancellation_policy text,
  cancellation_hours integer,
  refundable boolean,
  mandatory_amenities text[] NOT NULL DEFAULT '{}',
  optional_amenities text[] NOT NULL DEFAULT '{}',
  inclusions jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  source text NOT NULL DEFAULT 'derived',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT final_agreed_terms_rate_basis_chk CHECK (rate_basis IN ('per_night','total_stay'))
);
CREATE INDEX IF NOT EXISTS idx_fat_tenant ON public.final_agreed_terms(client_tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fat_awarded ON public.final_agreed_terms(awarded_program_id) WHERE awarded_program_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_agreed_terms TO authenticated;
GRANT ALL ON public.final_agreed_terms TO service_role;
ALTER TABLE public.final_agreed_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY fat_select ON public.final_agreed_terms FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY fat_insert ON public.final_agreed_terms FOR INSERT TO authenticated WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY fat_update ON public.final_agreed_terms FOR UPDATE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY fat_delete ON public.final_agreed_terms FOR DELETE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE TRIGGER final_agreed_terms_touch BEFORE UPDATE ON public.final_agreed_terms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- 2. PORTAL CONNECTIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_portal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  display_name text NOT NULL,
  portal_adapter_key text NOT NULL,
  portal_name text NOT NULL,
  base_url text NOT NULL,
  auth_type text NOT NULL DEFAULT 'password',
  credential_secret_ref text,
  username_hint text,
  mfa_mode text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'draft',
  adapter_version text,
  max_concurrent_sessions integer NOT NULL DEFAULT 1,
  last_connection_test_at timestamptz,
  last_connection_test_status text,
  last_error_code text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  authorized_by_client boolean NOT NULL DEFAULT false,
  authorization_confirmed_at timestamptz,
  authorization_confirmed_by uuid,
  read_only_confirmed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  CONSTRAINT rlpc_auth_type_chk CHECK (auth_type IN ('password','sso','token','other')),
  CONSTRAINT rlpc_mfa_chk CHECK (mfa_mode IN ('none','manual','totp','unknown')),
  CONSTRAINT rlpc_status_chk CHECK (status IN ('draft','configured','verified','needs_attention','disabled'))
);
CREATE INDEX IF NOT EXISTS idx_rlpc_tenant ON public.rate_loading_portal_connections(client_tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_loading_portal_connections TO authenticated;
GRANT ALL ON public.rate_loading_portal_connections TO service_role;
ALTER TABLE public.rate_loading_portal_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY rlpc_select ON public.rate_loading_portal_connections FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlpc_insert ON public.rate_loading_portal_connections FOR INSERT TO authenticated WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlpc_update ON public.rate_loading_portal_connections FOR UPDATE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlpc_delete ON public.rate_loading_portal_connections FOR DELETE TO authenticated USING (public.is_ta_master(auth.uid()));
CREATE TRIGGER rlpc_touch BEFORE UPDATE ON public.rate_loading_portal_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- 3. ENTITLEMENTS + USAGE LEDGER
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  usage_mode text NOT NULL DEFAULT 'disabled',
  quota_limit integer,
  quota_period text NOT NULL DEFAULT 'monthly',
  bonus_units integer NOT NULL DEFAULT 0,
  effective_from date,
  effective_until date,
  allow_overage boolean NOT NULL DEFAULT false,
  overage_limit integer,
  configured_by uuid,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fe_usage_mode_chk CHECK (usage_mode IN ('disabled','limited','unlimited')),
  CONSTRAINT fe_quota_period_chk CHECK (quota_period IN ('monthly','annual','contract')),
  CONSTRAINT fe_unique UNIQUE (client_tenant_id, feature_key)
);
GRANT SELECT ON public.feature_entitlements TO authenticated;
GRANT ALL ON public.feature_entitlements TO service_role;
ALTER TABLE public.feature_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY fe_select ON public.feature_entitlements FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY fe_ta_insert ON public.feature_entitlements FOR INSERT TO authenticated WITH CHECK (public.is_ta_master(auth.uid()));
CREATE POLICY fe_ta_update ON public.feature_entitlements FOR UPDATE TO authenticated USING (public.is_ta_master(auth.uid())) WITH CHECK (public.is_ta_master(auth.uid()));
CREATE TRIGGER fe_touch BEFORE UPDATE ON public.feature_entitlements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.feature_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  feature_key text NOT NULL,
  campaign_id uuid,
  check_id uuid,
  attempt_id uuid,
  usage_units integer NOT NULL DEFAULT 1,
  usage_status text NOT NULL DEFAULT 'reserved',
  usage_reason text,
  period_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT ful_status_chk CHECK (usage_status IN ('reserved','consumed','released'))
);
CREATE INDEX IF NOT EXISTS idx_ful_tenant_period ON public.feature_usage_ledger(client_tenant_id, feature_key, period_key);
CREATE INDEX IF NOT EXISTS idx_ful_check ON public.feature_usage_ledger(check_id);

GRANT SELECT ON public.feature_usage_ledger TO authenticated;
GRANT ALL ON public.feature_usage_ledger TO service_role;
ALTER TABLE public.feature_usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ful_select ON public.feature_usage_ledger FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));

-- ------------------------------------------------------------
-- 4. CAMPAIGNS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  rfp_id uuid REFERENCES public.rfps(id),
  portal_connection_id uuid REFERENCES public.rate_loading_portal_connections(id),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT rlc_status_chk CHECK (status IN ('draft','ready','queued','running','paused','completed','completed_with_errors','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_rlc_tenant ON public.rate_loading_campaigns(client_tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_loading_campaigns TO authenticated;
GRANT ALL ON public.rate_loading_campaigns TO service_role;
ALTER TABLE public.rate_loading_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY rlc_select ON public.rate_loading_campaigns FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlc_insert ON public.rate_loading_campaigns FOR INSERT TO authenticated WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlc_update ON public.rate_loading_campaigns FOR UPDATE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlc_delete ON public.rate_loading_campaigns FOR DELETE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE TRIGGER rlc_touch BEFORE UPDATE ON public.rate_loading_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- 5. CHECKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  campaign_id uuid NOT NULL REFERENCES public.rate_loading_campaigns(id) ON DELETE CASCADE,
  awarded_program_id uuid REFERENCES public.awarded_program(id),
  final_agreed_terms_id uuid REFERENCES public.final_agreed_terms(id),
  hotel_id uuid REFERENCES public.hotels(id),
  hotel_name text NOT NULL,
  city text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  number_of_nights integer NOT NULL,
  rooms integer NOT NULL DEFAULT 1,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  expected_snapshot jsonb NOT NULL,
  expected_snapshot_hash text NOT NULL,
  expected_rate_amount numeric,
  expected_currency text,
  expected_rate_basis text NOT NULL DEFAULT 'per_night',
  expected_room_type text,
  expected_rate_plan text,
  expected_rate_code text,
  expected_lra boolean,
  expected_refundable boolean,
  expected_breakfast boolean,
  expected_wifi boolean,
  expected_parking boolean,
  expected_taxes_included boolean,
  expected_cancellation_policy text,
  expected_amenities jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_tolerance_amount numeric NOT NULL DEFAULT 0,
  rate_tolerance_percent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  latest_attempt_id uuid,
  latest_result_code text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rlchk_campaign ON public.rate_loading_checks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rlchk_tenant ON public.rate_loading_checks(client_tenant_id);
CREATE INDEX IF NOT EXISTS idx_rlchk_awarded ON public.rate_loading_checks(awarded_program_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_loading_checks TO authenticated;
GRANT ALL ON public.rate_loading_checks TO service_role;
ALTER TABLE public.rate_loading_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY rlchk_select ON public.rate_loading_checks FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlchk_insert ON public.rate_loading_checks FOR INSERT TO authenticated WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlchk_update ON public.rate_loading_checks FOR UPDATE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rlchk_delete ON public.rate_loading_checks FOR DELETE TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE TRIGGER rlchk_touch BEFORE UPDATE ON public.rate_loading_checks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- 6. ATTEMPTS (append-only history)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  check_id uuid NOT NULL REFERENCES public.rate_loading_checks(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  job_id uuid,
  status text NOT NULL DEFAULT 'queued',
  worker_id text,
  correlation_id text,
  portal_adapter_key text,
  adapter_version text,
  started_at timestamptz,
  finished_at timestamptz,
  login_status text,
  search_status text,
  found_offer jsonb,
  result_code text,
  result_summary text,
  mismatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message_sanitized text,
  page_url text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rla_status_chk CHECK (status IN ('queued','running','completed','failed','needs_human_action','cancelled')),
  CONSTRAINT rla_unique UNIQUE (check_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_rla_check ON public.rate_loading_attempts(check_id);

GRANT SELECT, INSERT ON public.rate_loading_attempts TO authenticated;
GRANT ALL ON public.rate_loading_attempts TO service_role;
ALTER TABLE public.rate_loading_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rla_select ON public.rate_loading_attempts FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY rla_insert ON public.rate_loading_attempts FOR INSERT TO authenticated WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));

-- ------------------------------------------------------------
-- 7. JOB QUEUE (worker/service-role only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  campaign_id uuid NOT NULL REFERENCES public.rate_loading_campaigns(id) ON DELETE CASCADE,
  check_id uuid NOT NULL REFERENCES public.rate_loading_checks(id) ON DELETE CASCADE,
  portal_connection_id uuid REFERENCES public.rate_loading_portal_connections(id),
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  idempotency_key text NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rlj_status_chk CHECK (status IN ('pending','processing','completed','failed','dead_letter','cancelled')),
  CONSTRAINT rlj_idem_unique UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_rlj_claim ON public.rate_loading_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_rlj_campaign ON public.rate_loading_jobs(campaign_id);

GRANT SELECT ON public.rate_loading_jobs TO authenticated;
GRANT ALL ON public.rate_loading_jobs TO service_role;
ALTER TABLE public.rate_loading_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rlj_select ON public.rate_loading_jobs FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));

-- ------------------------------------------------------------
-- 8. EVIDENCE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_loading_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  campaign_id uuid REFERENCES public.rate_loading_campaigns(id) ON DELETE CASCADE,
  check_id uuid REFERENCES public.rate_loading_checks(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.rate_loading_attempts(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  page_url text,
  viewport text,
  retention_policy_days integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rle_type_chk CHECK (evidence_type IN ('result_screenshot','full_page_screenshot','error_screenshot','comparison_report','structured_result'))
);
CREATE INDEX IF NOT EXISTS idx_rle_attempt ON public.rate_loading_evidence(attempt_id);
CREATE INDEX IF NOT EXISTS idx_rle_check ON public.rate_loading_evidence(check_id);

GRANT SELECT ON public.rate_loading_evidence TO authenticated;
GRANT ALL ON public.rate_loading_evidence TO service_role;
ALTER TABLE public.rate_loading_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY rle_select ON public.rate_loading_evidence FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), client_tenant_id));

-- ------------------------------------------------------------
-- 9. JOB CLAIM (transactional, skip locked)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_rate_loading_job(_worker_id text, _lease_seconds integer DEFAULT 300)
RETURNS SETOF public.rate_loading_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recover expired leases first
  UPDATE public.rate_loading_jobs
     SET status = 'pending', locked_at = NULL, locked_by = NULL, lease_expires_at = NULL
   WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < now();

  RETURN QUERY
  UPDATE public.rate_loading_jobs j
     SET status = 'processing',
         locked_at = now(),
         locked_by = _worker_id,
         lease_expires_at = now() + (_lease_seconds || ' seconds')::interval,
         started_at = COALESCE(j.started_at, now()),
         attempts = j.attempts + 1
   WHERE j.id = (
     SELECT c.id FROM public.rate_loading_jobs c
      WHERE c.status = 'pending' AND c.available_at <= now()
      ORDER BY c.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
  RETURNING j.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_rate_loading_job(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_rate_loading_job(text, integer) TO service_role;

-- ------------------------------------------------------------
-- 10. QUOTA RESERVATION (transactional, concurrency safe)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_feature_quota(
  _tenant_id uuid,
  _feature_key text,
  _units integer,
  _campaign_id uuid,
  _period_key text
)
RETURNS TABLE(allowed boolean, available integer, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ent public.feature_entitlements%ROWTYPE;
  used integer;
  avail integer;
BEGIN
  SELECT * INTO ent FROM public.feature_entitlements
   WHERE client_tenant_id = _tenant_id AND feature_key = _feature_key
   FOR UPDATE;

  IF NOT FOUND OR ent.enabled = false OR ent.usage_mode = 'disabled' THEN
    RETURN QUERY SELECT false, 0, 'feature_disabled'::text;
    RETURN;
  END IF;

  IF ent.effective_from IS NOT NULL AND ent.effective_from > CURRENT_DATE THEN
    RETURN QUERY SELECT false, 0, 'not_yet_effective'::text; RETURN;
  END IF;
  IF ent.effective_until IS NOT NULL AND ent.effective_until < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 0, 'expired'::text; RETURN;
  END IF;

  IF ent.usage_mode = 'unlimited' THEN
    INSERT INTO public.feature_usage_ledger (client_tenant_id, feature_key, campaign_id, usage_units, usage_status, usage_reason, period_key)
    VALUES (_tenant_id, _feature_key, _campaign_id, _units, 'reserved', 'campaign_start', _period_key);
    RETURN QUERY SELECT true, 2147483647, 'unlimited'::text; RETURN;
  END IF;

  SELECT COALESCE(SUM(usage_units), 0) INTO used
    FROM public.feature_usage_ledger
   WHERE client_tenant_id = _tenant_id
     AND feature_key = _feature_key
     AND period_key = _period_key
     AND usage_status IN ('reserved','consumed');

  avail := COALESCE(ent.quota_limit, 0) + ent.bonus_units - used;
  IF ent.allow_overage THEN
    avail := avail + COALESCE(ent.overage_limit, 0);
  END IF;

  IF avail < _units THEN
    RETURN QUERY SELECT false, GREATEST(avail, 0), 'quota_exceeded'::text; RETURN;
  END IF;

  INSERT INTO public.feature_usage_ledger (client_tenant_id, feature_key, campaign_id, usage_units, usage_status, usage_reason, period_key)
  VALUES (_tenant_id, _feature_key, _campaign_id, _units, 'reserved', 'campaign_start', _period_key);

  RETURN QUERY SELECT true, avail - _units, 'ok'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_feature_quota(uuid, text, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_feature_quota(uuid, text, integer, uuid, text) TO service_role;