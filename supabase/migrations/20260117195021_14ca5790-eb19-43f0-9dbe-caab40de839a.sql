-- Update RLS policies on people table to include developer role

-- Drop existing policies
DROP POLICY IF EXISTS "Owners and employees can view all contacts" ON public.people;
DROP POLICY IF EXISTS "Owners and employees can insert contacts" ON public.people;
DROP POLICY IF EXISTS "Owners and employees can update contacts" ON public.people;
DROP POLICY IF EXISTS "Only owners can delete contacts" ON public.people;

-- Recreate policies with developer role included
CREATE POLICY "Internal users can view all contacts" 
ON public.people 
FOR SELECT 
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Internal users can insert contacts" 
ON public.people 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Internal users can update contacts" 
ON public.people 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Owners and developers can delete contacts" 
ON public.people 
FOR DELETE 
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);