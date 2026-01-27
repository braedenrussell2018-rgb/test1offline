-- Drop the existing ALL policy and create explicit policies for each operation
DROP POLICY IF EXISTS "Owners and developers can manage all spiff records" ON spiff_program;

-- Create explicit INSERT policy for owners and developers
CREATE POLICY "Owners and developers can insert spiff records"
ON spiff_program
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Create explicit UPDATE policy for owners and developers  
CREATE POLICY "Owners and developers can update spiff records"
ON spiff_program
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Create explicit DELETE policy for owners and developers
CREATE POLICY "Owners and developers can delete spiff records"
ON spiff_program
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Also fix spiff_warranties - drop ALL policy and create explicit ones
DROP POLICY IF EXISTS "Internal users can manage warranties" ON spiff_warranties;

-- Create explicit INSERT policy for internal users
CREATE POLICY "Internal users can insert warranties"
ON spiff_warranties
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Create explicit UPDATE policy for internal users
CREATE POLICY "Internal users can update warranties"
ON spiff_warranties
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Create explicit DELETE policy for internal users
CREATE POLICY "Internal users can delete warranties"
ON spiff_warranties
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));