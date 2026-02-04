-- Create a function to assign default employee role on signup
CREATE OR REPLACE FUNCTION public.assign_default_employee_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if the user doesn't already have a role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after a new user is created in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_employee_role();

-- Also assign employee role to any existing users without a role
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'employee'::app_role
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.id IS NULL;