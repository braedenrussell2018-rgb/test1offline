-- =====================================================
-- CRITICAL SECURITY FIX: Secure Role Assignment
-- This migration prevents privilege escalation via self-registration
-- =====================================================

-- Create a function to validate role assignment
CREATE OR REPLACE FUNCTION public.validate_role_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserter_role app_role;
  is_new_user boolean;
BEGIN
  -- Check if this is a new user (no existing roles)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id
  ) INTO is_new_user;

  -- If user is inserting their own role (self-registration)
  IF NEW.user_id = auth.uid() AND is_new_user THEN
    -- SECURITY: Only allow customer or salesman for self-registration
    IF NEW.role NOT IN ('customer', 'salesman') THEN
      RAISE EXCEPTION 'Self-registration is only allowed for customer or salesman roles. Contact an administrator for elevated access.';
    END IF;
    RETURN NEW;
  END IF;

  -- If someone else is assigning a role (admin action)
  IF NEW.user_id != auth.uid() THEN
    -- Get the role of the person making the change
    SELECT role INTO inserter_role 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    LIMIT 1;

    -- Only owners can assign roles to other users
    IF inserter_role IS NULL OR inserter_role != 'owner' THEN
      RAISE EXCEPTION 'Only owners can assign roles to other users';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_role_insert ON public.user_roles;

-- Create the trigger
CREATE TRIGGER check_role_insert
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_insert();

-- Also protect against role updates (privilege escalation)
CREATE OR REPLACE FUNCTION public.validate_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updater_role app_role;
BEGIN
  -- Get the role of the person making the change
  SELECT role INTO updater_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  -- Only owners can change roles
  IF updater_role IS NULL OR updater_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can modify user roles';
  END IF;

  -- Owners cannot demote themselves (prevent lockout)
  IF OLD.user_id = auth.uid() AND OLD.role = 'owner' AND NEW.role != 'owner' THEN
    RAISE EXCEPTION 'Owners cannot demote themselves. Another owner must make this change.';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_role_update ON public.user_roles;

-- Create the update trigger
CREATE TRIGGER check_role_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_update();

-- Protect against role deletion
CREATE OR REPLACE FUNCTION public.validate_role_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleter_role app_role;
  owner_count integer;
BEGIN
  -- Get the role of the person making the change
  SELECT role INTO deleter_role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  -- Only owners can delete roles
  IF deleter_role IS NULL OR deleter_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can delete user roles';
  END IF;

  -- Prevent deleting the last owner
  IF OLD.role = 'owner' THEN
    SELECT COUNT(*) INTO owner_count FROM public.user_roles WHERE role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last owner. Assign another owner first.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_role_delete ON public.user_roles;

-- Create the delete trigger
CREATE TRIGGER check_role_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_delete();

-- ===========================================
-- ADD AUDIT LOGGING TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs
CREATE POLICY "Only owners can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Add comment explaining the security model
COMMENT ON FUNCTION public.validate_role_insert() IS 
'Security trigger: Prevents privilege escalation by restricting self-registration to customer/salesman roles only. Owner and employee roles must be assigned by existing owners.';