-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a table to track new user signups for developer notifications
CREATE TABLE IF NOT EXISTS public.signup_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  signed_up_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signup_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Developers and owners can view signup notifications" ON public.signup_notifications;
DROP POLICY IF EXISTS "Developers and owners can update signup notifications" ON public.signup_notifications;

-- Only developers and owners can view signup notifications
CREATE POLICY "Developers and owners can view signup notifications"
ON public.signup_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('developer', 'owner')
  )
);

-- Only developers and owners can update (mark as read)
CREATE POLICY "Developers and owners can update signup notifications"
ON public.signup_notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('developer', 'owner')
  )
);

-- Create or replace the function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into signup_notifications
  INSERT INTO public.signup_notifications (user_id, email, full_name, signed_up_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown'),
    NEW.created_at
  );
  
  -- Also handle profiles table if needed (keep existing functionality)
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Update the has_role function to treat developer like owner
CREATE OR REPLACE FUNCTION public.has_role(_role app_role, _user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Developer has all owner privileges
  IF _role = 'owner' THEN
    RETURN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id 
      AND role IN ('owner', 'developer')
    );
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id 
    AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the get_user_role function for developer support
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role AS $$
DECLARE
  _role app_role;
BEGIN
  SELECT role INTO _role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;