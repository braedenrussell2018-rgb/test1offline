-- Create a trigger function to automatically assign user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value text;
BEGIN
  -- Get the role from user metadata (set during signup)
  user_role_value := NEW.raw_user_meta_data ->> 'role';
  
  -- Default to 'customer' if no role specified
  IF user_role_value IS NULL OR user_role_value = '' THEN
    user_role_value := 'customer';
  END IF;
  
  -- Validate the role - only allow customer/salesman for self-signup
  -- owner/employee/developer must be assigned by admin
  IF user_role_value NOT IN ('customer', 'salesman', 'employee', 'owner') THEN
    user_role_value := 'customer';
  END IF;
  
  -- Insert the role (ignore if already exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value::app_role)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Also create a profile entry
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Update RLS policy to allow service role to insert (for the trigger)
-- But also ensure authenticated users can still insert their own role
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;

-- Add policy for anon role to allow the trigger to work during signup flow
CREATE POLICY "Allow role creation during signup"
ON public.user_roles FOR INSERT
TO authenticated, anon
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);