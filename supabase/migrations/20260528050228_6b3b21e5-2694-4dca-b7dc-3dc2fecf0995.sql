
-- ===========================================================================
-- 1. decision_alerts
-- ===========================================================================
CREATE TABLE public.decision_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN (
    'ADR_VARIANCE','SMART_LEAKAGE','RATE_LOADING',
    'HOTEL_UNDERPERFORMANCE','HOTEL_DEPENDENCY','SAVINGS_MISSED'
  )),
  severity text NOT NULL CHECK (severity IN ('high','medium','low')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  impacted_city text,
  impacted_hotel text,
  financial_impact numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','dismissed','completed')),
  dismissed_at timestamptz,
  completed_at timestamptz,
  signature text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX decision_alerts_signature_uniq
  ON public.decision_alerts (client_tenant_id, signature);
CREATE INDEX decision_alerts_status_idx
  ON public.decision_alerts (client_tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_alerts TO authenticated;
GRANT ALL ON public.decision_alerts TO service_role;
ALTER TABLE public.decision_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_alerts"
  ON public.decision_alerts FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_alerts"
  ON public.decision_alerts FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update decision_alerts"
  ON public.decision_alerts FOR UPDATE TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "TA master deletes decision_alerts"
  ON public.decision_alerts FOR DELETE TO authenticated
  USING (public.is_ta_master(auth.uid()));

CREATE TRIGGER decision_alerts_touch
  BEFORE UPDATE ON public.decision_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===========================================================================
-- 2. decision_actions
-- ===========================================================================
CREATE TABLE public.decision_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  alert_id uuid,
  type text NOT NULL CHECK (type IN ('SEND_ALERT','FOLLOW_UP','IGNORE','OPEN_MINI_RFP','ADD_TO_PIPELINE')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING','SENT','WAITING_RESPONSE','RESPONDED','COMPLETED','IGNORED'
  )),
  assigned_to uuid,
  email_recipients text[],
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_actions_status_idx ON public.decision_actions (client_tenant_id, status);
CREATE INDEX decision_actions_alert_idx ON public.decision_actions (alert_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_actions TO authenticated;
GRANT ALL ON public.decision_actions TO service_role;
ALTER TABLE public.decision_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_actions"
  ON public.decision_actions FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_actions"
  ON public.decision_actions FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update decision_actions"
  ON public.decision_actions FOR UPDATE TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "TA master deletes decision_actions"
  ON public.decision_actions FOR DELETE TO authenticated
  USING (public.is_ta_master(auth.uid()));

CREATE TRIGGER decision_actions_touch
  BEFORE UPDATE ON public.decision_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===========================================================================
-- 3. decision_watchlist
-- ===========================================================================
CREATE TABLE public.decision_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  action_id uuid NOT NULL UNIQUE,
  pinned boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_watchlist_tenant_idx ON public.decision_watchlist (client_tenant_id, pinned, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_watchlist TO authenticated;
GRANT ALL ON public.decision_watchlist TO service_role;
ALTER TABLE public.decision_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_watchlist"
  ON public.decision_watchlist FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_watchlist"
  ON public.decision_watchlist FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update decision_watchlist"
  ON public.decision_watchlist FOR UPDATE TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "TA master deletes decision_watchlist"
  ON public.decision_watchlist FOR DELETE TO authenticated
  USING (public.is_ta_master(auth.uid()));

CREATE TRIGGER decision_watchlist_touch
  BEFORE UPDATE ON public.decision_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-insert watchlist row when an action is created
CREATE OR REPLACE FUNCTION public.decision_actions_to_watchlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.decision_watchlist (client_tenant_id, action_id, summary, last_activity_at)
  VALUES (NEW.client_tenant_id, NEW.id, COALESCE(NEW.type, ''), now())
  ON CONFLICT (action_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decision_actions_watchlist_seed
  AFTER INSERT ON public.decision_actions
  FOR EACH ROW EXECUTE FUNCTION public.decision_actions_to_watchlist();

-- ===========================================================================
-- 4. decision_followups
-- ===========================================================================
CREATE TABLE public.decision_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email','call','meeting','note')),
  scheduled_at timestamptz,
  executed_at timestamptz,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','done','no_response','cancelled')),
  notes text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_followups_action_idx ON public.decision_followups (action_id);
CREATE INDEX decision_followups_due_idx ON public.decision_followups (client_tenant_id, scheduled_at) WHERE outcome = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_followups TO authenticated;
GRANT ALL ON public.decision_followups TO service_role;
ALTER TABLE public.decision_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_followups"
  ON public.decision_followups FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_followups"
  ON public.decision_followups FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update decision_followups"
  ON public.decision_followups FOR UPDATE TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "TA master deletes decision_followups"
  ON public.decision_followups FOR DELETE TO authenticated
  USING (public.is_ta_master(auth.uid()));

CREATE TRIGGER decision_followups_touch
  BEFORE UPDATE ON public.decision_followups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bump watchlist activity when a follow-up is added/changed
CREATE OR REPLACE FUNCTION public.decision_bump_watchlist_from_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.decision_watchlist
     SET last_activity_at = now(),
         due_at = COALESCE(NEW.scheduled_at, due_at)
   WHERE action_id = NEW.action_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decision_followups_watchlist_bump
  AFTER INSERT OR UPDATE ON public.decision_followups
  FOR EACH ROW EXECUTE FUNCTION public.decision_bump_watchlist_from_followup();

-- ===========================================================================
-- 5. decision_comments
-- ===========================================================================
CREATE TABLE public.decision_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  action_id uuid,
  alert_id uuid,
  body text NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decision_comments_target_chk CHECK (action_id IS NOT NULL OR alert_id IS NOT NULL)
);
CREATE INDEX decision_comments_action_idx ON public.decision_comments (action_id);
CREATE INDEX decision_comments_alert_idx ON public.decision_comments (alert_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_comments TO authenticated;
GRANT ALL ON public.decision_comments TO service_role;
ALTER TABLE public.decision_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_comments"
  ON public.decision_comments FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_comments"
  ON public.decision_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id) AND author_id = auth.uid());
CREATE POLICY "Authors update own decision_comments"
  ON public.decision_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "TA master deletes decision_comments"
  ON public.decision_comments FOR DELETE TO authenticated
  USING (public.is_ta_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.decision_bump_watchlist_from_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action_id IS NOT NULL THEN
    UPDATE public.decision_watchlist
       SET last_activity_at = now()
     WHERE action_id = NEW.action_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decision_comments_watchlist_bump
  AFTER INSERT ON public.decision_comments
  FOR EACH ROW EXECUTE FUNCTION public.decision_bump_watchlist_from_comment();

-- ===========================================================================
-- 6. decision_attachments
-- ===========================================================================
CREATE TABLE public.decision_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  action_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_attachments_action_idx ON public.decision_attachments (action_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_attachments TO authenticated;
GRANT ALL ON public.decision_attachments TO service_role;
ALTER TABLE public.decision_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read decision_attachments"
  ON public.decision_attachments FOR SELECT TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert decision_attachments"
  ON public.decision_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete decision_attachments"
  ON public.decision_attachments FOR DELETE TO authenticated
  USING (public.can_see_tenant(auth.uid(), client_tenant_id));
