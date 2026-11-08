CREATE TABLE public.sheet_geolocation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_tenant_id uuid NOT NULL REFERENCES public.tenants(id), created_by uuid NOT NULL,
 filename text NOT NULL, storage_path text NOT NULL, file_hash text, sheet text, header_row integer, kind text NOT NULL DEFAULT 'office', mapping jsonb NOT NULL DEFAULT '{}', rows jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'draft', checkpoint integer NOT NULL DEFAULT 0, request_budget integer NOT NULL DEFAULT 2000, requests_reserved integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, next_batch_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sheet_geo_status CHECK (status IN ('draft','paused','running','processed','cancelled')),
 CONSTRAINT sheet_geo_kind CHECK (kind IN ('hotel','office','store')),
 CONSTRAINT sheet_geo_budget CHECK (request_budget BETWEEN 1 AND 6000 AND requests_reserved >= 0 AND requests_reserved <= request_budget)
);
GRANT SELECT, INSERT, UPDATE ON public.sheet_geolocation_jobs TO authenticated;
GRANT ALL ON public.sheet_geolocation_jobs TO service_role;
ALTER TABLE public.sheet_geolocation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sheet_geo_scope ON public.sheet_geolocation_jobs FOR ALL TO authenticated USING (public.proximity_access(client_tenant_id)) WITH CHECK (public.proximity_access(client_tenant_id));
CREATE INDEX sheet_geo_tenant ON public.sheet_geolocation_jobs(client_tenant_id,created_at DESC);
CREATE UNIQUE INDEX sheet_geo_import_unique ON public.sheet_geolocation_jobs(client_tenant_id,file_hash,sheet,header_row,kind,(mapping::text)) WHERE file_hash IS NOT NULL;
CREATE FUNCTION public.sheet_geo_claim(_job_id uuid, _tenant_id uuid, _token uuid) RETURNS SETOF public.sheet_geolocation_jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.proximity_access(_tenant_id) THEN RAISE EXCEPTION 'TA access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sheet_geo:' || _tenant_id::text,0));
 IF EXISTS (SELECT 1 FROM public.sheet_geolocation_jobs WHERE client_tenant_id=_tenant_id AND ((lease_until>now()) OR (next_batch_at>now()))) THEN RETURN; END IF;
 RETURN QUERY UPDATE public.sheet_geolocation_jobs SET lease_token=_token,lease_until=now()+interval '180 seconds' WHERE id=_job_id AND client_tenant_id=_tenant_id AND status='running' AND (lease_until IS NULL OR lease_until<now()) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.sheet_geo_claim(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sheet_geo_claim(uuid,uuid,uuid) TO authenticated;
CREATE POLICY sheet_geo_original_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='sheet-geolocation-originals' AND EXISTS (SELECT 1 FROM public.sheet_geolocation_jobs j WHERE j.storage_path=name AND public.proximity_access(j.client_tenant_id)));
CREATE POLICY sheet_geo_original_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='sheet-geolocation-originals' AND EXISTS (SELECT 1 FROM public.sheet_geolocation_jobs j WHERE j.storage_path=name AND j.status='draft' AND j.created_by=auth.uid() AND public.proximity_access(j.client_tenant_id)));
