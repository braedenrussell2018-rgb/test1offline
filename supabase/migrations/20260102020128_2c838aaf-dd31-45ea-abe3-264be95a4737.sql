-- Drop existing permissive policies on expenses
DROP POLICY IF EXISTS "Authenticated users can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;

-- Only owners and employees can view expenses
CREATE POLICY "Owners and employees can view expenses" 
ON public.expenses 
FOR SELECT 
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Only owners and employees can insert expenses
CREATE POLICY "Owners and employees can insert expenses" 
ON public.expenses 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Only owners and employees can update expenses
CREATE POLICY "Owners and employees can update expenses" 
ON public.expenses 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Only owners can delete expenses
CREATE POLICY "Only owners can delete expenses" 
ON public.expenses 
FOR DELETE 
USING (has_role(auth.uid(), 'owner'));