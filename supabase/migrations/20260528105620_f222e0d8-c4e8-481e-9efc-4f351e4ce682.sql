
-- =========================================================
-- STRATEGY: tiering, caps, clusters
-- =========================================================

CREATE TABLE public.strategy_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  tier text NOT NULL,
  brands text[] NOT NULL DEFAULT '{}',
  qs_min numeric NOT NULL DEFAULT 0,
  qs_max numeric NOT NULL DEFAULT 100,
  share_pct numeric NOT NULL DEFAULT 0,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_tiers TO authenticated;
GRANT ALL ON public.strategy_tiers TO service_role;
ALTER TABLE public.strategy_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read strategy_tiers" ON public.strategy_tiers FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert strategy_tiers" ON public.strategy_tiers FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update strategy_tiers" ON public.strategy_tiers FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete strategy_tiers" ON public.strategy_tiers FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE TABLE public.strategy_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  city text NOT NULL,
  baseline_adr numeric NOT NULL DEFAULT 0,
  suggested_cap numeric NOT NULL DEFAULT 0,
  approved_cap numeric,
  rationale text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_tenant_id, city)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_caps TO authenticated;
GRANT ALL ON public.strategy_caps TO service_role;
ALTER TABLE public.strategy_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read strategy_caps" ON public.strategy_caps FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert strategy_caps" ON public.strategy_caps FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update strategy_caps" ON public.strategy_caps FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete strategy_caps" ON public.strategy_caps FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE TABLE public.strategy_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  name text NOT NULL,
  hotels text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  rationale text,
  share_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_clusters TO authenticated;
GRANT ALL ON public.strategy_clusters TO service_role;
ALTER TABLE public.strategy_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read strategy_clusters" ON public.strategy_clusters FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert strategy_clusters" ON public.strategy_clusters FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update strategy_clusters" ON public.strategy_clusters FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete strategy_clusters" ON public.strategy_clusters FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

-- =========================================================
-- ANALYSIS: rfp comparison rows
-- =========================================================

CREATE TABLE public.rfp_analysis_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  rfp_id uuid,
  hotel_name text NOT NULL,
  city text NOT NULL,
  current_adr numeric NOT NULL DEFAULT 0,
  proposed_adr numeric NOT NULL DEFAULT 0,
  savings_pct numeric NOT NULL DEFAULT 0,
  quality_score numeric NOT NULL DEFAULT 0,
  compliance_pct numeric NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{}',
  recommendation text NOT NULL DEFAULT 'review',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfp_analysis_rows TO authenticated;
GRANT ALL ON public.rfp_analysis_rows TO service_role;
ALTER TABLE public.rfp_analysis_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read rfp_analysis_rows" ON public.rfp_analysis_rows FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert rfp_analysis_rows" ON public.rfp_analysis_rows FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update rfp_analysis_rows" ON public.rfp_analysis_rows FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete rfp_analysis_rows" ON public.rfp_analysis_rows FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

-- =========================================================
-- NEGOTIATION: lots + threads
-- =========================================================

CREATE TABLE public.negotiation_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  hotels_count int NOT NULL DEFAULT 0,
  target_savings_pct numeric NOT NULL DEFAULT 0,
  current_savings_pct numeric NOT NULL DEFAULT 0,
  owner text,
  deadline date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiation_lots TO authenticated;
GRANT ALL ON public.negotiation_lots TO service_role;
ALTER TABLE public.negotiation_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read negotiation_lots" ON public.negotiation_lots FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert negotiation_lots" ON public.negotiation_lots FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update negotiation_lots" ON public.negotiation_lots FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete negotiation_lots" ON public.negotiation_lots FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE TABLE public.negotiation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  hotel_name text NOT NULL,
  city text NOT NULL,
  starting_adr numeric NOT NULL DEFAULT 0,
  current_offer numeric NOT NULL DEFAULT 0,
  target_adr numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_message_at timestamptz,
  last_message_from text,
  owner text,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiation_threads TO authenticated;
GRANT ALL ON public.negotiation_threads TO service_role;
ALTER TABLE public.negotiation_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read negotiation_threads" ON public.negotiation_threads FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert negotiation_threads" ON public.negotiation_threads FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update negotiation_threads" ON public.negotiation_threads FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete negotiation_threads" ON public.negotiation_threads FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

-- =========================================================
-- PROGRAM: awarded hotels + demand targets
-- =========================================================

CREATE TABLE public.awarded_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  hotel_name text NOT NULL,
  brand text,
  city text NOT NULL,
  tier text NOT NULL DEFAULT 'Midscale',
  final_adr numeric NOT NULL DEFAULT 0,
  cap numeric NOT NULL DEFAULT 0,
  starting_adr numeric NOT NULL DEFAULT 0,
  room_nights int NOT NULL DEFAULT 0,
  quality_score numeric NOT NULL DEFAULT 0,
  compliance_pct numeric NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{}',
  cancellation_hours int NOT NULL DEFAULT 24,
  contract_start date,
  contract_end date,
  status text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.awarded_program TO authenticated;
GRANT ALL ON public.awarded_program TO service_role;
ALTER TABLE public.awarded_program ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read awarded_program" ON public.awarded_program FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert awarded_program" ON public.awarded_program FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update awarded_program" ON public.awarded_program FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete awarded_program" ON public.awarded_program FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE TABLE public.demand_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL,
  city text NOT NULL,
  target_nights int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_tenant_id, city)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_targets TO authenticated;
GRANT ALL ON public.demand_targets TO service_role;
ALTER TABLE public.demand_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible tenants read demand_targets" ON public.demand_targets FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants insert demand_targets" ON public.demand_targets FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants update demand_targets" ON public.demand_targets FOR UPDATE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id)) WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));
CREATE POLICY "Visible tenants delete demand_targets" ON public.demand_targets FOR DELETE TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

-- =========================================================
-- Indices úteis
-- =========================================================
CREATE INDEX idx_strategy_tiers_tenant ON public.strategy_tiers(client_tenant_id);
CREATE INDEX idx_strategy_caps_tenant ON public.strategy_caps(client_tenant_id);
CREATE INDEX idx_strategy_clusters_tenant ON public.strategy_clusters(client_tenant_id);
CREATE INDEX idx_rfp_analysis_rows_tenant ON public.rfp_analysis_rows(client_tenant_id);
CREATE INDEX idx_rfp_analysis_rows_rfp ON public.rfp_analysis_rows(rfp_id);
CREATE INDEX idx_negotiation_lots_tenant ON public.negotiation_lots(client_tenant_id);
CREATE INDEX idx_negotiation_threads_tenant ON public.negotiation_threads(client_tenant_id);
CREATE INDEX idx_negotiation_threads_lot ON public.negotiation_threads(lot_id);
CREATE INDEX idx_awarded_program_tenant ON public.awarded_program(client_tenant_id);
CREATE INDEX idx_demand_targets_tenant ON public.demand_targets(client_tenant_id);

-- updated_at triggers
CREATE TRIGGER strategy_tiers_touch BEFORE UPDATE ON public.strategy_tiers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER strategy_caps_touch BEFORE UPDATE ON public.strategy_caps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER strategy_clusters_touch BEFORE UPDATE ON public.strategy_clusters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rfp_analysis_rows_touch BEFORE UPDATE ON public.rfp_analysis_rows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER negotiation_lots_touch BEFORE UPDATE ON public.negotiation_lots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER negotiation_threads_touch BEFORE UPDATE ON public.negotiation_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER awarded_program_touch BEFORE UPDATE ON public.awarded_program FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER demand_targets_touch BEFORE UPDATE ON public.demand_targets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
