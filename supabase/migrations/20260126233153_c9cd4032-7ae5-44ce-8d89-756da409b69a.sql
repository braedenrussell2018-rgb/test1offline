-- Add approval status to spiff_program table
ALTER TABLE public.spiff_program 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'adjusted'));

-- Add approved_by and approved_at fields
ALTER TABLE public.spiff_program 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS adjusted_amount NUMERIC,
ADD COLUMN IF NOT EXISTS adjusted_credits INTEGER,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create spiff_warranties table for tracking warranties from spiff sales
CREATE TABLE IF NOT EXISTS public.spiff_warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spiff_sale_id UUID REFERENCES public.spiff_program(id) ON DELETE CASCADE NOT NULL,
    serial_number TEXT NOT NULL,
    sale_description TEXT NOT NULL,
    salesman_id UUID REFERENCES auth.users(id) NOT NULL,
    warranty_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    warranty_months INTEGER NOT NULL DEFAULT 12,
    warranty_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spiff_warranties ENABLE ROW LEVEL SECURITY;

-- RLS policies for spiff_warranties
-- Salesmen can view their own warranties
CREATE POLICY "Salesmen can view own warranties" 
ON public.spiff_warranties 
FOR SELECT 
USING (
    salesman_id = auth.uid() OR
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'developer')
);

-- Internal users can manage all warranties
CREATE POLICY "Internal users can manage warranties" 
ON public.spiff_warranties 
FOR ALL 
USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'developer')
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_spiff_warranties_salesman ON public.spiff_warranties(salesman_id);
CREATE INDEX IF NOT EXISTS idx_spiff_warranties_serial ON public.spiff_warranties(serial_number);
CREATE INDEX IF NOT EXISTS idx_spiff_program_status ON public.spiff_program(status);

-- Enable realtime for spiff_warranties
ALTER PUBLICATION supabase_realtime ADD TABLE public.spiff_warranties;

-- Update timestamp trigger for spiff_warranties
CREATE TRIGGER update_spiff_warranties_updated_at
BEFORE UPDATE ON public.spiff_warranties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();