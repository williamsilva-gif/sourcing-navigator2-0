
-- 1) Fix mutable search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2) Tighten permissive RLS policy on tenant_modules (replace WITH CHECK true)
DROP POLICY IF EXISTS "TMC admin manages own children modules" ON public.tenant_modules;
CREATE POLICY "TMC admin manages own children modules"
ON public.tenant_modules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_modules.tenant_id
      AND t.parent_tenant_id IS NOT NULL
      AND public.has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, t.parent_tenant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_modules.tenant_id
      AND t.parent_tenant_id IS NOT NULL
      AND public.has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, t.parent_tenant_id)
  )
);

-- 3) Revoke direct API execution of SECURITY DEFINER helpers.
--    RLS policies still evaluate these (policies run server-side, not via PostgREST EXECUTE),
--    but anon/authenticated clients cannot invoke them through the API.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role_in_tenant(uuid, app_role, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ta_master(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.visible_tenant_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_tenant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
