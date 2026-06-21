
-- 1. baseline_contracts: scope UPDATE policy to authenticated
DROP POLICY IF EXISTS "Visible tenants update contracts" ON public.baseline_contracts;
CREATE POLICY "Visible tenants update contracts"
ON public.baseline_contracts
FOR UPDATE TO authenticated
USING (can_see_tenant(auth.uid(), client_tenant_id))
WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));

-- 2. billing_events: scope INSERT policy to authenticated
DROP POLICY IF EXISTS "Privileged users insert billing events" ON public.billing_events;
CREATE POLICY "Privileged users insert billing events"
ON public.billing_events
FOR INSERT TO authenticated
WITH CHECK (
  is_ta_master(auth.uid())
  OR (tmc_tenant_id IS NOT NULL AND has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, tmc_tenant_id))
);

-- 3. user_roles: scope DELETE policy to authenticated
DROP POLICY IF EXISTS "TMC admin revokes roles in own tenants" ON public.user_roles;
CREATE POLICY "TMC admin revokes roles in own tenants"
ON public.user_roles
FOR DELETE TO authenticated
USING (
  has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, tenant_id)
  AND role = ANY (ARRAY['tmc_user'::app_role, 'corp_admin'::app_role, 'corp_user'::app_role])
);

-- 4. hotels: restrict INSERT to TA master / TMC admins
DROP POLICY IF EXISTS "Authenticated users can register hotels" ON public.hotels;
CREATE POLICY "Privileged users register hotels"
ON public.hotels
FOR INSERT TO authenticated
WITH CHECK (
  is_ta_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'tmc_admin'::app_role
  )
);

-- 5. baseline-files storage: add explicit UPDATE policy
DROP POLICY IF EXISTS "Visible tenants update baseline files" ON storage.objects;
CREATE POLICY "Visible tenants update baseline files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'baseline-files'
    AND (
      public.is_ta_master(auth.uid())
      OR public.can_see_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'baseline-files'
    AND (
      public.is_ta_master(auth.uid())
      OR public.can_see_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
