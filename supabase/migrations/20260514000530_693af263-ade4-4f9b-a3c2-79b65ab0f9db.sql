
-- ============== ENUMS ==============
CREATE TYPE public.tenant_type AS ENUM ('TA', 'TMC', 'CORP', 'HOTEL');
CREATE TYPE public.app_role AS ENUM (
  'ta_master', 'ta_staff',
  'tmc_admin', 'tmc_user',
  'corp_admin', 'corp_user',
  'hotel_admin', 'hotel_user'
);

-- ============== TENANTS ==============
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.tenant_type NOT NULL,
  name text NOT NULL,
  parent_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  billing_status text NOT NULL DEFAULT 'active',
  terms_accepted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_parent ON public.tenants(parent_tenant_id);
CREATE INDEX idx_tenants_type ON public.tenants(type);

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============== USER_ROLES ==============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- ============== TENANT MODULES & THRESHOLDS ==============
CREATE TABLE public.tenant_modules (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, module_key)
);

CREATE TABLE public.tenant_thresholds (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value numeric NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

-- ============== BILLING EVENTS ==============
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmc_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  client_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  terms_version text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_billing_events_tmc ON public.billing_events(tmc_tenant_id);

-- ============== SECURITY DEFINER FUNCTIONS ==============

-- Check if user has a specific role (in any tenant or scoped)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id uuid, _role public.app_role, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
$$;

-- Returns true if user is TA master (sees everything)
CREATE OR REPLACE FUNCTION public.is_ta_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ta_master', 'ta_staff')
  )
$$;

-- Returns set of tenant_ids visible to a user
-- TA: all tenants. TMC: own + children. CORP/HOTEL: own only.
CREATE OR REPLACE FUNCTION public.visible_tenant_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH user_tenants AS (
    SELECT DISTINCT ur.tenant_id, t.type
    FROM public.user_roles ur
    JOIN public.tenants t ON t.id = ur.tenant_id
    WHERE ur.user_id = _user_id
  )
  SELECT id FROM public.tenants
  WHERE
    -- TA master/staff sees all
    public.is_ta_master(_user_id)
    -- own tenants
    OR id IN (SELECT tenant_id FROM user_tenants)
    -- TMC sees children
    OR parent_tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE type = 'TMC'
    )
$$;

CREATE OR REPLACE FUNCTION public.can_see_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _tenant_id IN (SELECT public.visible_tenant_ids(_user_id))
$$;

-- ============== TRIGGERS ==============

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tenants_touch BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== RLS ==============
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- TENANTS policies
CREATE POLICY "Users see visible tenants" ON public.tenants
FOR SELECT TO authenticated
USING (public.can_see_tenant(auth.uid(), id));

CREATE POLICY "TA master can insert tenants" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (public.is_ta_master(auth.uid()));

CREATE POLICY "TMC can insert child tenants" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (
  parent_tenant_id IS NOT NULL
  AND public.has_role_in_tenant(auth.uid(), 'tmc_admin', parent_tenant_id)
);

CREATE POLICY "TA master updates tenants" ON public.tenants
FOR UPDATE TO authenticated
USING (public.is_ta_master(auth.uid()));

-- PROFILES policies
CREATE POLICY "User reads own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "User updates own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "TA master reads all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_ta_master(auth.uid()));

-- USER_ROLES policies
CREATE POLICY "User reads own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "TA master reads all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_ta_master(auth.uid()));

CREATE POLICY "TA master manages roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_ta_master(auth.uid()))
WITH CHECK (public.is_ta_master(auth.uid()));

CREATE POLICY "TMC admin grants roles in own tenants" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role_in_tenant(auth.uid(), 'tmc_admin', tenant_id)
  AND role IN ('tmc_user', 'corp_admin', 'corp_user')
);

-- TENANT_MODULES / THRESHOLDS policies
CREATE POLICY "Users see modules of visible tenants" ON public.tenant_modules
FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), tenant_id));

CREATE POLICY "TA master manages modules" ON public.tenant_modules
FOR ALL TO authenticated
USING (public.is_ta_master(auth.uid())) WITH CHECK (public.is_ta_master(auth.uid()));

CREATE POLICY "TMC admin manages own children modules" ON public.tenant_modules
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = tenant_modules.tenant_id
    AND t.parent_tenant_id IS NOT NULL
    AND public.has_role_in_tenant(auth.uid(), 'tmc_admin', t.parent_tenant_id)
)) WITH CHECK (true);

CREATE POLICY "Users see thresholds of visible tenants" ON public.tenant_thresholds
FOR SELECT TO authenticated USING (public.can_see_tenant(auth.uid(), tenant_id));

CREATE POLICY "TA master manages thresholds" ON public.tenant_thresholds
FOR ALL TO authenticated
USING (public.is_ta_master(auth.uid())) WITH CHECK (public.is_ta_master(auth.uid()));

-- BILLING_EVENTS policies
CREATE POLICY "TA master reads all billing" ON public.billing_events
FOR SELECT TO authenticated USING (public.is_ta_master(auth.uid()));

CREATE POLICY "TMC reads own billing" ON public.billing_events
FOR SELECT TO authenticated
USING (
  tmc_tenant_id IS NOT NULL
  AND public.has_role_in_tenant(auth.uid(), 'tmc_admin', tmc_tenant_id)
);

CREATE POLICY "Authenticated can insert billing events" ON public.billing_events
FOR INSERT TO authenticated WITH CHECK (
  tmc_tenant_id IS NULL
  OR public.has_role_in_tenant(auth.uid(), 'tmc_admin', tmc_tenant_id)
);

-- ============== SEED ==============
DO $$
DECLARE
  ta_id uuid;
  acme_id uuid;
BEGIN
  INSERT INTO public.tenants (type, name) VALUES ('TA', 'Travel Academy')
  RETURNING id INTO ta_id;

  INSERT INTO public.tenants (type, name, parent_tenant_id)
  VALUES ('CORP', 'Acme Travel Corp', ta_id)
  RETURNING id INTO acme_id;

  -- Default modules for TA (all enabled)
  INSERT INTO public.tenant_modules (tenant_id, module_key, enabled)
  SELECT ta_id, k, true FROM unnest(ARRAY[
    'dashboard','diagnostico','estrategia','rfp','analise',
    'negociacao','selecao','implementacao','monitoramento','monetizacao','admin'
  ]) k;

  -- Acme: corporate defaults
  INSERT INTO public.tenant_modules (tenant_id, module_key, enabled) VALUES
    (acme_id,'dashboard',true),(acme_id,'diagnostico',true),(acme_id,'estrategia',true),
    (acme_id,'rfp',false),(acme_id,'analise',true),(acme_id,'negociacao',true),
    (acme_id,'selecao',false),(acme_id,'implementacao',true),(acme_id,'monitoramento',true),
    (acme_id,'monetizacao',false),(acme_id,'admin',false);
END $$;
