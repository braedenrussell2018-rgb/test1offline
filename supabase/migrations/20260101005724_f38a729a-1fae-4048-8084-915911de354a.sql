-- Add serial_number column to spiff_program table
ALTER TABLE public.spiff_program 
ADD COLUMN serial_number text;