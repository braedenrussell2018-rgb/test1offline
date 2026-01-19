-- Drop the existing RESTRICTIVE policies on quotes table
DROP POLICY IF EXISTS "Internal users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Internal users can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Internal users can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Owners and developers can delete any quote" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;

-- Create PERMISSIVE policies for internal users (owner, employee, developer)
CREATE POLICY "Internal users can view quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Internal users can insert quotes"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Internal users can update quotes"
ON public.quotes
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Internal users can delete quotes"
ON public.quotes
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);

-- Also allow salesmen to view/manage their own quotes
CREATE POLICY "Salesmen can view own quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'salesman'::app_role) AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Salesmen can insert own quotes"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'salesman'::app_role) AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Salesmen can update own quotes"
ON public.quotes
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'salesman'::app_role) AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);