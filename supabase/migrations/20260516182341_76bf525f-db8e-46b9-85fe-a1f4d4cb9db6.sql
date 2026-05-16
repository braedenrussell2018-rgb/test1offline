
-- 1. Replace name-based salesman scoping with created_by (UUID) scoping
DROP POLICY IF EXISTS "Tenant salesman can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant salesman can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant salesman can update own invoices" ON public.invoices;

CREATE POLICY "Tenant salesman can view own invoices"
ON public.invoices FOR SELECT
USING (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Tenant salesman can insert own invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Tenant salesman can update own invoices"
ON public.invoices FOR UPDATE
USING (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

-- quotes may not have created_by; add it if missing
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS created_by uuid;

DROP POLICY IF EXISTS "Tenant salesman can view own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Tenant salesman can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Tenant salesman can update own quotes" ON public.quotes;

CREATE POLICY "Tenant salesman can view own quotes"
ON public.quotes FOR SELECT
USING (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Tenant salesman can insert own quotes"
ON public.quotes FOR INSERT
WITH CHECK (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

CREATE POLICY "Tenant salesman can update own quotes"
ON public.quotes FOR UPDATE
USING (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman'::app_role])
  AND created_by = auth.uid()
);

-- 2. Prevent self-unlock via user_security_settings
-- Replace permissive self-update with a trigger that blocks non-admins
-- from touching lock-related fields.
CREATE OR REPLACE FUNCTION public.protect_user_security_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if caller is owner or developer
  IF public.has_role(auth.uid(), 'owner'::app_role)
     OR public.has_role(auth.uid(), 'developer'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Otherwise, block changes to lock / failed-attempt fields
  IF NEW.account_locked IS DISTINCT FROM OLD.account_locked
     OR NEW.account_locked_at IS DISTINCT FROM OLD.account_locked_at
     OR NEW.account_locked_reason IS DISTINCT FROM OLD.account_locked_reason
     OR NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts
     OR NEW.last_failed_login IS DISTINCT FROM OLD.last_failed_login THEN
    RAISE EXCEPTION 'Not authorized to modify account lock or failed-login fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_security_settings ON public.user_security_settings;
CREATE TRIGGER trg_protect_user_security_settings
BEFORE UPDATE ON public.user_security_settings
FOR EACH ROW EXECUTE FUNCTION public.protect_user_security_settings();

-- 3. Realtime channel authorization: restrict subscriptions to tenant members
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal tenant members can receive realtime" ON realtime.messages;
CREATE POLICY "Internal tenant members can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('owner'::app_role, 'employee'::app_role, 'developer'::app_role, 'salesman'::app_role)
  )
  OR public.is_global_developer(auth.uid())
);

-- 4. Remove auto-assign-employee trigger so self-signups don't gain global role
DROP TRIGGER IF EXISTS on_auth_user_assign_default_role ON auth.users;
DROP TRIGGER IF EXISTS assign_default_employee_role_trigger ON auth.users;
