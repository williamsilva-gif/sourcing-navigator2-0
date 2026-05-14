
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ta_tenant_id uuid;
  v_account_type text;
  v_org_name text;
  v_tenant_type tenant_type;
  v_role app_role;
  v_new_tenant_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'william.silva@travelacademy.com.br' THEN
    SELECT id INTO ta_tenant_id FROM public.tenants WHERE type = 'TA' LIMIT 1;
    IF ta_tenant_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, tenant_id, role)
      VALUES (NEW.id, ta_tenant_id, 'ta_master')
      ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET primary_tenant_id = ta_tenant_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  v_account_type := upper(coalesce(NEW.raw_user_meta_data->>'account_type', ''));
  v_org_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'org_name'), ''), split_part(NEW.email, '@', 2));

  -- Public signup is restricted: TA accounts can only be created via internal invite
  IF v_account_type NOT IN ('HOTEL', 'TMC', 'CORP') THEN
    RETURN NEW;
  END IF;

  CASE v_account_type
    WHEN 'HOTEL' THEN v_tenant_type := 'HOTEL'; v_role := 'hotel_admin';
    WHEN 'TMC'   THEN v_tenant_type := 'TMC';   v_role := 'tmc_admin';
    WHEN 'CORP'  THEN v_tenant_type := 'CORP';  v_role := 'corp_admin';
  END CASE;

  INSERT INTO public.tenants (type, name)
  VALUES (v_tenant_type, v_org_name)
  RETURNING id INTO v_new_tenant_id;

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_new_tenant_id, v_role);

  UPDATE public.profiles SET primary_tenant_id = v_new_tenant_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
