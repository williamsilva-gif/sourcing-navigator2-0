REVOKE INSERT,UPDATE ON public.tax_impact_source_checks FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_tax_impact_source_check(uuid,date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_tax_impact_source_check(uuid,date) TO service_role;
COMMENT ON TABLE public.tax_impact_source_checks IS 'Official source verification cache; only authenticated authorized server logic may write using the server client, preventing browser-forged validated statuses.';