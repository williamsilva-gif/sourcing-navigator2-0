-- user_module_overrides
CREATE TABLE public.user_module_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_overrides TO authenticated;
GRANT ALL ON public.user_module_overrides TO service_role;

ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own module overrides"
  ON public.user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id));

CREATE POLICY "ta or tenant admin writes module overrides"
  ON public.user_module_overrides FOR ALL TO authenticated
  USING (public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id))
  WITH CHECK (public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id));

-- user_feature_overrides
CREATE TABLE public.user_feature_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_feature_overrides TO authenticated;
GRANT ALL ON public.user_feature_overrides TO service_role;

ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own feature overrides"
  ON public.user_feature_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id));

CREATE POLICY "ta or tenant admin writes feature overrides"
  ON public.user_feature_overrides FOR ALL TO authenticated
  USING (public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id))
  WITH CHECK (public.is_ta_master(auth.uid())
         OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'corp_admin', tenant_id)
         OR public.has_role_in_tenant(auth.uid(), 'hotel_admin', tenant_id));

-- Effective access functions: user override -> tenant template -> default true
CREATE OR REPLACE FUNCTION public.is_module_enabled_for_user(_user_id uuid, _tenant_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.user_module_overrides WHERE user_id = _user_id AND tenant_id = _tenant_id AND module_key = _key),
    (SELECT enabled FROM public.tenant_modules WHERE tenant_id = _tenant_id AND module_key = _key),
    true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_feature_enabled_for_user(_user_id uuid, _tenant_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.user_feature_overrides WHERE user_id = _user_id AND tenant_id = _tenant_id AND feature_key = _key),
    (SELECT enabled FROM public.tenant_features WHERE tenant_id = _tenant_id AND feature_key = _key),
    true
  )
$$;

CREATE OR REPLACE FUNCTION public.effective_user_access(_user_id uuid, _tenant_id uuid)
RETURNS TABLE(kind text, key text, enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'module'::text, module_key, enabled FROM public.user_module_overrides
   WHERE user_id = _user_id AND tenant_id = _tenant_id
  UNION ALL
  SELECT 'module', tm.module_key, tm.enabled FROM public.tenant_modules tm
   WHERE tm.tenant_id = _tenant_id
     AND NOT EXISTS (SELECT 1 FROM public.user_module_overrides u
                      WHERE u.user_id = _user_id AND u.tenant_id = _tenant_id AND u.module_key = tm.module_key)
  UNION ALL
  SELECT 'feature', feature_key, enabled FROM public.user_feature_overrides
   WHERE user_id = _user_id AND tenant_id = _tenant_id
  UNION ALL
  SELECT 'feature', tf.feature_key, tf.enabled FROM public.tenant_features tf
   WHERE tf.tenant_id = _tenant_id
     AND NOT EXISTS (SELECT 1 FROM public.user_feature_overrides u
                      WHERE u.user_id = _user_id AND u.tenant_id = _tenant_id AND u.feature_key = tf.feature_key)
$$;
