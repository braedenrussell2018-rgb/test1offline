
-- 1) Backfill any signed-up user who has no tenant membership into the sole tenant
DO $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants LIMIT 2;
  IF (SELECT count(*) FROM public.tenants) = 1 THEN
    SELECT id INTO v_tenant FROM public.tenants LIMIT 1;

    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    SELECT v_tenant, p.user_id, COALESCE((SELECT role FROM public.user_roles WHERE user_id = p.user_id LIMIT 1), 'employee'::app_role), 'active'
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.user_id = p.user_id)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
       SET current_tenant_id = v_tenant
     WHERE current_tenant_id IS NULL;
  END IF;
END $$;

-- 2) Trigger: when a new user signs up, if the project has exactly one tenant,
--    auto-join them to it as an employee. Multi-tenant projects must use the
--    admin-user-management edge function to assign tenants explicitly.
CREATE OR REPLACE FUNCTION public.auto_join_default_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenants;
  IF v_count = 1 THEN
    SELECT id INTO v_tenant FROM public.tenants LIMIT 1;

    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    VALUES (v_tenant, NEW.user_id, 'employee'::app_role, 'active')
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
       SET current_tenant_id = v_tenant
     WHERE user_id = NEW.user_id
       AND current_tenant_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_join_default_tenant ON public.profiles;
CREATE TRIGGER trg_auto_join_default_tenant
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_join_default_tenant();
