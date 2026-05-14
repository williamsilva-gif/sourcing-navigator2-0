
-- Auto-grant ta_master role to the master TA email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ta_tenant_id uuid;
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
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (recreate to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
