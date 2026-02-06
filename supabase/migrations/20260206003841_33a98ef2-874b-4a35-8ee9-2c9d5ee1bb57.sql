
-- Add created_by and updated_by columns to people table
ALTER TABLE public.people ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.people ADD COLUMN updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
