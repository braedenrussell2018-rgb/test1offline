-- Drop existing policy that allows all authenticated users to view profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Owners can view all profiles
CREATE POLICY "Owners can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'));