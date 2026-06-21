CREATE TABLE public.access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL,
  actor_user_id uuid,
  kind text NOT NULL CHECK (kind IN ('module','feature')),
  key text NOT NULL,
  action text NOT NULL CHECK (action IN ('set','reset')),
  previous_value boolean,
  new_value boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_audit_tenant ON public.access_audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_access_audit_user ON public.access_audit_log (target_user_id, created_at DESC);

GRANT SELECT ON public.access_audit_log TO authenticated;
GRANT ALL ON public.access_audit_log TO service_role;

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ta or tenant admin reads audit"
  ON public.access_audit_log FOR SELECT TO authenticated
  USING (public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id));

-- Bulk reset: wipe every override (module + feature) for every user in a tenant.
-- Returns the number of rows deleted. SECURITY DEFINER so we can audit cleanly.
CREATE OR REPLACE FUNCTION public.reset_all_user_overrides_for_tenant(_tenant_id uuid, _actor uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  r record;
BEGIN
  -- Authorize: only TA master/staff or a tenant admin of this tenant
  IF NOT (public.is_ta_master(_actor)
          OR public.has_role_in_tenant(_actor, 'tmc_admin', _tenant_id)
          OR public.has_role_in_tenant(_actor, 'corp_admin', _tenant_id)
          OR public.has_role_in_tenant(_actor, 'hotel_admin', _tenant_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN SELECT user_id, module_key, enabled FROM public.user_module_overrides WHERE tenant_id = _tenant_id LOOP
    INSERT INTO public.access_audit_log (tenant_id, target_user_id, actor_user_id, kind, key, action, previous_value, new_value)
    VALUES (_tenant_id, r.user_id, _actor, 'module', r.module_key, 'reset', r.enabled, NULL);
    deleted_count := deleted_count + 1;
  END LOOP;
  DELETE FROM public.user_module_overrides WHERE tenant_id = _tenant_id;

  FOR r IN SELECT user_id, feature_key, enabled FROM public.user_feature_overrides WHERE tenant_id = _tenant_id LOOP
    INSERT INTO public.access_audit_log (tenant_id, target_user_id, actor_user_id, kind, key, action, previous_value, new_value)
    VALUES (_tenant_id, r.user_id, _actor, 'feature', r.feature_key, 'reset', r.enabled, NULL);
    deleted_count := deleted_count + 1;
  END LOOP;
  DELETE FROM public.user_feature_overrides WHERE tenant_id = _tenant_id;

  RETURN deleted_count;
END;
$$;
