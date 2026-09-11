-- Evidence files are readable only by users who can see the owning tenant.
-- Path convention: <client_tenant_id>/<campaign_id>/<check_id>/<file>
CREATE POLICY "rl evidence read by tenant"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rate-loading-evidence'
  AND public.can_see_tenant(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Writes come from the backend service role only (worker uploads via server route).
CREATE POLICY "rl evidence service write"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'rate-loading-evidence');

CREATE POLICY "rl evidence service delete"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'rate-loading-evidence');