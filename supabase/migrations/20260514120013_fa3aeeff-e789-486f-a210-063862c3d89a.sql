
-- Consent logs
CREATE TABLE public.consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('cookies_essential','cookies_functional','cookies_analytics','cookies_marketing','marketing_email','terms','privacy_policy')),
  granted boolean NOT NULL,
  policy_version text NOT NULL DEFAULT 'v1.0',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_logs_user ON public.consent_logs(user_id, created_at DESC);

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own consents"
  ON public.consent_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ta_master(auth.uid()));

CREATE POLICY "Users insert own consents"
  ON public.consent_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Account deletion requests
CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deletion requests"
  ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ta_master(auth.uid()));

CREATE POLICY "Users create own deletion request"
  ON public.account_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "TA master manages deletion requests"
  ON public.account_deletion_requests FOR UPDATE TO authenticated
  USING (public.is_ta_master(auth.uid()))
  WITH CHECK (public.is_ta_master(auth.uid()));

-- Block ta_master self-deletion
CREATE OR REPLACE FUNCTION public.block_ta_master_self_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'ta_master'
  ) THEN
    RAISE EXCEPTION 'Admin Master accounts cannot be scheduled for deletion';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER block_ta_master_deletion
  BEFORE INSERT ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.block_ta_master_self_deletion();
