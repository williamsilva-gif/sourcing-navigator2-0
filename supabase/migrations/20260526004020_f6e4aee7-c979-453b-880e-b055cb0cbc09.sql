
-- 1. baseline_contracts: add missing UPDATE policy
CREATE POLICY "Visible tenants update contracts"
ON public.baseline_contracts
FOR UPDATE
USING (can_see_tenant(auth.uid(), client_tenant_id))
WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));

-- 2. billing_events: remove permissive NULL-tmc branch
DROP POLICY IF EXISTS "Authenticated can insert billing events" ON public.billing_events;
CREATE POLICY "Privileged users insert billing events"
ON public.billing_events
FOR INSERT
WITH CHECK (
  is_ta_master(auth.uid())
  OR (tmc_tenant_id IS NOT NULL AND has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, tmc_tenant_id))
);

-- 3. hotel_members: remove privilege-escalating self-join
DROP POLICY IF EXISTS "User self-joins as member" ON public.hotel_members;

-- 4. user_roles: allow tmc_admin to revoke roles they can grant
CREATE POLICY "TMC admin revokes roles in own tenants"
ON public.user_roles
FOR DELETE
USING (
  has_role_in_tenant(auth.uid(), 'tmc_admin'::app_role, tenant_id)
  AND role = ANY (ARRAY['tmc_user'::app_role, 'corp_admin'::app_role, 'corp_user'::app_role])
);
