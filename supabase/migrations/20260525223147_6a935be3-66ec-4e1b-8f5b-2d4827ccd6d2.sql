
-- ============================================================
-- baseline_uploads: histórico de cargas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.baseline_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  dataset_type text NOT NULL CHECK (dataset_type IN ('bookings','hotels','contracts')),
  filename text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','partial','error')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baseline_uploads_tenant ON public.baseline_uploads(client_tenant_id, uploaded_at DESC);

ALTER TABLE public.baseline_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read uploads"
  ON public.baseline_uploads FOR SELECT TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert uploads"
  ON public.baseline_uploads FOR INSERT TO authenticated
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete uploads"
  ON public.baseline_uploads FOR DELETE TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));

-- Link bookings to uploads so deleting an upload can cascade-clean its rows
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS upload_id uuid;
CREATE INDEX IF NOT EXISTS idx_bookings_upload ON public.bookings(upload_id);

-- ============================================================
-- baseline_contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.baseline_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  upload_id uuid REFERENCES public.baseline_uploads(id) ON DELETE CASCADE,
  hotel_code text,
  hotel_name text NOT NULL,
  city text,
  cap numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  valid_from date,
  valid_until date,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON public.baseline_contracts(client_tenant_id);

ALTER TABLE public.baseline_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read contracts"
  ON public.baseline_contracts FOR SELECT TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants write contracts"
  ON public.baseline_contracts FOR INSERT TO authenticated
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete contracts"
  ON public.baseline_contracts FOR DELETE TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));

-- ============================================================
-- client_actions: ações executadas por cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  opportunity_id text,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('renegotiation','cap_adjustment','cluster_change','mini_rfp','communication')),
  module text NOT NULL,
  city text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_progress','completed')),
  effort text NOT NULL DEFAULT 'medium' CHECK (effort IN ('low','medium','high')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_actions_tenant ON public.client_actions(client_tenant_id, created_at DESC);

ALTER TABLE public.client_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read actions"
  ON public.client_actions FOR SELECT TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants write actions"
  ON public.client_actions FOR INSERT TO authenticated
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update actions"
  ON public.client_actions FOR UPDATE TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete actions"
  ON public.client_actions FOR DELETE TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id));

-- Auto-update updated_at on client_actions
DROP TRIGGER IF EXISTS trg_client_actions_touch ON public.client_actions;
CREATE TRIGGER trg_client_actions_touch
  BEFORE UPDATE ON public.client_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
