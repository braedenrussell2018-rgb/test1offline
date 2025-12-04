-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.people;

-- Create new policy allowing any authenticated user to update contacts
CREATE POLICY "Authenticated users can update contacts" 
ON public.people 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);