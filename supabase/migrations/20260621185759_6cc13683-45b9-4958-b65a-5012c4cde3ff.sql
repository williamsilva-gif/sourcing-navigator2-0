
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'TMC',
  ADD COLUMN IF NOT EXISTS default_cap numeric NOT NULL DEFAULT 280;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_environment_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_environment_check
  CHECK (environment IN ('TMC','Corporate','Supplier'));
