-- Add excavator_lines column to people table for filtering
ALTER TABLE public.people 
ADD COLUMN excavator_lines text[] DEFAULT '{}'::text[];