-- Drop existing permissive policies on invoices
DROP POLICY IF EXISTS "Authenticated users can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;

-- Add created_by column to track who created the invoice
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Owners and employees can view all invoices
CREATE POLICY "Owners and employees can view all invoices" 
ON public.invoices 
FOR SELECT 
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Salesmen can only view invoices where they are the salesman
CREATE POLICY "Salesmen can view their own invoices" 
ON public.invoices 
FOR SELECT 
USING (
  has_role(auth.uid(), 'salesman') AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);

-- Owners and employees can insert invoices
CREATE POLICY "Owners and employees can insert invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Salesmen can insert their own invoices
CREATE POLICY "Salesmen can insert their own invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'salesman') AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);

-- Owners and employees can update invoices
CREATE POLICY "Owners and employees can update invoices" 
ON public.invoices 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'employee')
);

-- Salesmen can update their own invoices
CREATE POLICY "Salesmen can update their own invoices" 
ON public.invoices 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'salesman') AND 
  salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);

-- Only owners can delete invoices
CREATE POLICY "Only owners can delete invoices" 
ON public.invoices 
FOR DELETE 
USING (has_role(auth.uid(), 'owner'));