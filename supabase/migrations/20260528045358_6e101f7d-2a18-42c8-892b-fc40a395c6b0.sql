
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets() FROM PUBLIC, anon, authenticated;
