-- Converts one reserved unit into consumed (billable) or released (non-billable).
-- Called once per finished check by the backend result endpoint.
CREATE OR REPLACE FUNCTION public.finalize_feature_usage(
  _tenant_id uuid,
  _feature_key text,
  _period_key text,
  _campaign_id uuid,
  _check_id uuid,
  _attempt_id uuid,
  _billable boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  res_id uuid;
  res_units integer;
BEGIN
  SELECT id, usage_units INTO res_id, res_units
    FROM public.feature_usage_ledger
   WHERE client_tenant_id = _tenant_id
     AND feature_key = _feature_key
     AND period_key = _period_key
     AND campaign_id IS NOT DISTINCT FROM _campaign_id
     AND usage_status = 'reserved'
     AND usage_units > 0
   ORDER BY created_at
   FOR UPDATE
   LIMIT 1;

  IF res_id IS NOT NULL THEN
    IF res_units <= 1 THEN
      UPDATE public.feature_usage_ledger
         SET usage_units = 0, finalized_at = now()
       WHERE id = res_id;
    ELSE
      UPDATE public.feature_usage_ledger
         SET usage_units = res_units - 1
       WHERE id = res_id;
    END IF;
  END IF;

  INSERT INTO public.feature_usage_ledger
    (client_tenant_id, feature_key, campaign_id, check_id, attempt_id,
     usage_units, usage_status, usage_reason, period_key, finalized_at)
  VALUES
    (_tenant_id, _feature_key, _campaign_id, _check_id, _attempt_id,
     1, CASE WHEN _billable THEN 'consumed' ELSE 'released' END,
     COALESCE(_reason, CASE WHEN _billable THEN 'check_completed' ELSE 'technical_error' END),
     _period_key, now());
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_feature_usage(uuid, text, text, uuid, uuid, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_feature_usage(uuid, text, text, uuid, uuid, uuid, boolean, text) TO service_role;