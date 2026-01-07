-- Update the role validation trigger to allow 'employee' for self-registration
CREATE OR REPLACE FUNCTION public.validate_role_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- SECURITY: Allow customer, salesman, and employee for self-registration
    IF NEW.role NOT IN ('customer', 'salesman', 'employee') THEN
      RAISE EXCEPTION 'Self-registration is only allowed for customer, salesman, or employee roles. Contact an administrator for elevated access.';
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
$function$;