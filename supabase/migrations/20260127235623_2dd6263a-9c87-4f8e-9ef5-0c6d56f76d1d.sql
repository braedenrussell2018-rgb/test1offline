-- Add status column to invoices table for draft support
ALTER TABLE public.invoices 
ADD COLUMN status TEXT NOT NULL DEFAULT 'finalized';

-- Update existing invoices to be finalized
UPDATE public.invoices SET status = 'finalized' WHERE status IS NULL OR status = '';

-- Add comment for clarity
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: draft or finalized';