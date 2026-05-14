
-- ============ HOTELS ============
CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id_owner uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  address text,
  city text NOT NULL,
  state text,
  country_code text,
  postal_code text,
  phone text,
  contact_name text,
  contact_email text,
  cnpj text,
  latitude numeric,
  longitude numeric,
  star_rating numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotels_city ON public.hotels (city);
CREATE INDEX idx_hotels_owner ON public.hotels (tenant_id_owner);
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hotel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'hotel_user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, user_id)
);
ALTER TABLE public.hotel_members ENABLE ROW LEVEL SECURITY;

-- helper: is user a member of a hotel?
CREATE OR REPLACE FUNCTION public.is_hotel_member(_user_id uuid, _hotel_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotel_members
    WHERE user_id = _user_id AND hotel_id = _hotel_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_hotel_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Policies: hotels
CREATE POLICY "TA master manages all hotels" ON public.hotels
  FOR ALL TO authenticated
  USING (is_ta_master(auth.uid()))
  WITH CHECK (is_ta_master(auth.uid()));

CREATE POLICY "Owners and members read hotel" ON public.hotels
  FOR SELECT TO authenticated
  USING (
    is_ta_master(auth.uid())
    OR (tenant_id_owner IS NOT NULL AND can_see_tenant(auth.uid(), tenant_id_owner))
    OR is_hotel_member(auth.uid(), id)
  );

CREATE POLICY "Authenticated users can register hotels" ON public.hotels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members and TA can update hotels" ON public.hotels
  FOR UPDATE TO authenticated
  USING (is_ta_master(auth.uid()) OR is_hotel_member(auth.uid(), id))
  WITH CHECK (is_ta_master(auth.uid()) OR is_hotel_member(auth.uid(), id));

-- Policies: hotel_members
CREATE POLICY "TA master manages members" ON public.hotel_members
  FOR ALL TO authenticated
  USING (is_ta_master(auth.uid()))
  WITH CHECK (is_ta_master(auth.uid()));

CREATE POLICY "User reads own memberships" ON public.hotel_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "User self-joins as member" ON public.hotel_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ BOOKINGS ============
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_external_id text,
  hotel_name text NOT NULL,
  city text NOT NULL,
  state text,
  checkin date,
  room_nights numeric NOT NULL DEFAULT 0,
  adr numeric NOT NULL DEFAULT 0,
  channel text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_tenant ON public.bookings (client_tenant_id);
CREATE INDEX idx_bookings_city ON public.bookings (city);
CREATE INDEX idx_bookings_checkin ON public.bookings (checkin);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read bookings" ON public.bookings
  FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE POLICY "Visible tenants insert bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));

CREATE POLICY "Visible tenants update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));

CREATE POLICY "TA master deletes bookings" ON public.bookings
  FOR DELETE TO authenticated USING (is_ta_master(auth.uid()));

-- ============ RFPs ============
CREATE TABLE public.rfps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  deadline timestamptz,
  pois jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfps_tenant ON public.rfps (client_tenant_id);
ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible tenants read rfps" ON public.rfps
  FOR SELECT TO authenticated USING (can_see_tenant(auth.uid(), client_tenant_id));

CREATE POLICY "Visible tenants manage rfps" ON public.rfps
  FOR ALL TO authenticated
  USING (can_see_tenant(auth.uid(), client_tenant_id))
  WITH CHECK (can_see_tenant(auth.uid(), client_tenant_id));

-- ============ RFP_INVITATIONS ============
CREATE TABLE public.rfp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfp_id, hotel_id)
);
CREATE INDEX idx_rfp_invitations_hotel ON public.rfp_invitations (hotel_id);
ALTER TABLE public.rfp_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client and hotel read invitations" ON public.rfp_invitations
  FOR SELECT TO authenticated
  USING (
    is_ta_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = rfp_invitations.rfp_id AND can_see_tenant(auth.uid(), r.client_tenant_id))
    OR is_hotel_member(auth.uid(), hotel_id)
  );

CREATE POLICY "Client manages invitations" ON public.rfp_invitations
  FOR ALL TO authenticated
  USING (
    is_ta_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = rfp_invitations.rfp_id AND can_see_tenant(auth.uid(), r.client_tenant_id))
  )
  WITH CHECK (
    is_ta_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = rfp_invitations.rfp_id AND can_see_tenant(auth.uid(), r.client_tenant_id))
  );

-- ============ RFP_RESPONSES ============
CREATE TABLE public.rfp_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfp_id, hotel_id)
);
CREATE INDEX idx_rfp_responses_rfp ON public.rfp_responses (rfp_id);
ALTER TABLE public.rfp_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client and hotel read responses" ON public.rfp_responses
  FOR SELECT TO authenticated
  USING (
    is_ta_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rfps r WHERE r.id = rfp_responses.rfp_id AND can_see_tenant(auth.uid(), r.client_tenant_id))
    OR is_hotel_member(auth.uid(), hotel_id)
  );

CREATE POLICY "Hotel members submit responses" ON public.rfp_responses
  FOR INSERT TO authenticated
  WITH CHECK (is_hotel_member(auth.uid(), hotel_id));

CREATE POLICY "Hotel members update own responses" ON public.rfp_responses
  FOR UPDATE TO authenticated
  USING (is_hotel_member(auth.uid(), hotel_id))
  WITH CHECK (is_hotel_member(auth.uid(), hotel_id));

-- ============ Triggers updated_at ============
CREATE TRIGGER trg_hotels_touch BEFORE UPDATE ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_rfps_touch BEFORE UPDATE ON public.rfps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
