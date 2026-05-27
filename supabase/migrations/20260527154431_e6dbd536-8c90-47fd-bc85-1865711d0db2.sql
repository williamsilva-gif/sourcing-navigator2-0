-- 1. Add storage_path to baseline_uploads
ALTER TABLE public.baseline_uploads
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 2. Create the private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('baseline-files', 'baseline-files', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects scoped to bucket
-- Path convention: {client_tenant_id}/{upload_id}/{filename}
-- The first folder is the tenant_id and is checked against visible_tenant_ids

CREATE POLICY "Visible tenants read baseline files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'baseline-files'
    AND (
      public.is_ta_master(auth.uid())
      OR public.can_see_tenant(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
    )
  );

CREATE POLICY "Visible tenants upload baseline files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'baseline-files'
    AND (
      public.is_ta_master(auth.uid())
      OR public.can_see_tenant(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
    )
  );

CREATE POLICY "TA master deletes baseline files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'baseline-files'
    AND public.is_ta_master(auth.uid())
  );