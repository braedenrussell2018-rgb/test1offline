-- Add salesman_name column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN salesman_name text;

-- Add salesman_name column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN salesman_name text;