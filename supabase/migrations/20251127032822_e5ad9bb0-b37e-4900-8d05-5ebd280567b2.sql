-- Add user_id column to people table to track who created each contact
ALTER TABLE public.people ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_people_user_id ON public.people(user_id);

-- Drop existing RLS policies on people table
DROP POLICY IF EXISTS "Authenticated users can delete people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can insert people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can update people" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can view all people" ON public.people;

-- Create new RLS policies that scope data to the user who created it
CREATE POLICY "Users can view their own contacts"
ON public.people
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
ON public.people
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.people
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.people
FOR DELETE
USING (auth.uid() = user_id);