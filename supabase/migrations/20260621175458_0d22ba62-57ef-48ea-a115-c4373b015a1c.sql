
CREATE TABLE IF NOT EXISTS public.tenant_features (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_features TO authenticated;
GRANT ALL ON public.tenant_features TO service_role;

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_features readable by tenant members"
  ON public.tenant_features FOR SELECT
  TO authenticated
  USING (public.can_see_tenant(auth.uid(), tenant_id));

CREATE POLICY "tenant_features writable by TA master"
  ON public.tenant_features FOR ALL
  TO authenticated
  USING (public.is_ta_master(auth.uid()))
  WITH CHECK (public.is_ta_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_feature(_tenant_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.tenant_features WHERE tenant_id = _tenant_id AND feature_key = _key),
    true
  )
$$;
