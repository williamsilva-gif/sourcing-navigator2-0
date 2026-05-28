
CREATE TABLE public.rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX idx_rate_limit_window ON public.rate_limit_buckets(window_start);

GRANT ALL ON public.rate_limit_buckets TO service_role;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No policies = no access except service_role (which bypasses RLS)

-- Atomic check-and-increment function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key TEXT,
  _max INTEGER,
  _window_seconds INTEGER
) RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % _window_seconds) * interval '1 second';

  INSERT INTO public.rate_limit_buckets (bucket_key, window_start, count)
  VALUES (_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  IF v_count > _max THEN
    RETURN QUERY SELECT
      FALSE,
      v_count,
      GREATEST(1, _window_seconds - extract(epoch from (now() - v_window_start))::integer);
  ELSE
    RETURN QUERY SELECT TRUE, v_count, 0;
  END IF;
END;
$$;

-- Cleanup function (called by pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_buckets
  WHERE window_start < now() - interval '1 hour';
$$;

-- Schedule cleanup every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'cleanup-rate-limit-buckets',
  '*/15 * * * *',
  $$ SELECT public.cleanup_rate_limit_buckets(); $$
);
