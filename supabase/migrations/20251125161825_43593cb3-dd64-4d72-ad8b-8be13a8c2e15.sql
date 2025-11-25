-- Add paid status to invoices table
ALTER TABLE public.invoices 
ADD COLUMN paid boolean DEFAULT false,
ADD COLUMN paid_at timestamp with time zone;

-- Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name text NOT NULL,
  customer_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text,
  receipt_url text,
  credit_card_last4 text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for expenses
CREATE POLICY "Authenticated users can view all expenses"
ON public.expenses FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert expenses"
ON public.expenses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
ON public.expenses FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete expenses"
ON public.expenses FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Storage policies for receipts
CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can update receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts');