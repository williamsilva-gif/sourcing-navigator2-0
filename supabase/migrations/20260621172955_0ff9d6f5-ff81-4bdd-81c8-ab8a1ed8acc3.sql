CREATE POLICY "Baseline uploads update by tenant members"
ON public.baseline_uploads
FOR UPDATE
TO authenticated
USING (public.can_see_tenant(auth.uid(), client_tenant_id))
WITH CHECK (public.can_see_tenant(auth.uid(), client_tenant_id));