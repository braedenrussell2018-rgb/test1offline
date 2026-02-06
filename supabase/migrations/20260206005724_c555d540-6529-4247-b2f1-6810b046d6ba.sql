-- Fix critical: user_roles privilege escalation
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow role creation during signup" ON public.user_roles;

-- The handle_new_user_role() trigger (SECURITY DEFINER) already handles role creation during signup.
-- No self-service INSERT policy is needed. Only owners/developers should manually assign roles.
-- The existing "Owners and developers can manage all roles" ALL policy covers admin INSERT/UPDATE/DELETE.