-- Encrypted credential storage for portal connections.
-- Service-role only: no anon/authenticated grants, RLS enabled with no policies
-- so the Data API can never reach it. Resolved exclusively by the backend.
CREATE TABLE IF NOT EXISTS public.rate_loading_portal_credentials (
  secret_ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.rate_loading_portal_connections(id) ON DELETE CASCADE,
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  ciphertext text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  rotated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rlpcred_conn ON public.rate_loading_portal_credentials(connection_id);

GRANT ALL ON public.rate_loading_portal_credentials TO service_role;
ALTER TABLE public.rate_loading_portal_credentials ENABLE ROW LEVEL SECURITY;

-- Adapter health snapshot per connection is already on the connection row.
-- Add a needs-attention helper index for the pending queue view.
CREATE INDEX IF NOT EXISTS idx_rlchk_status ON public.rate_loading_checks(status, latest_result_code);