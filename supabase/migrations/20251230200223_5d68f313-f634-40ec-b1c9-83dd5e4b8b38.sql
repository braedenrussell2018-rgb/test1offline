-- Fix 1: Update the add_note_to_contact function to use SECURITY INVOKER
-- This makes it respect RLS policies on the people table
CREATE OR REPLACE FUNCTION public.add_note_to_contact(p_person_id uuid, p_note_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_notes jsonb;
  v_new_note jsonb;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the new note object
  v_new_note := jsonb_build_object(
    'text', p_note_text,
    'timestamp', now()::text
  );

  -- Get current notes (RLS policies will apply since using SECURITY INVOKER)
  SELECT COALESCE(notes, '[]'::jsonb) INTO v_current_notes
  FROM public.people
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found or not authorized';
  END IF;

  -- Append new note to existing notes array (RLS UPDATE policy will apply)
  UPDATE public.people
  SET notes = v_current_notes || v_new_note,
      updated_at = now()
  WHERE id = p_person_id;
END;
$$;

-- Fix 2: Update receipts bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'receipts';

-- Drop existing policies and create new ones with unique names
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Receipt upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Receipt view policy" ON storage.objects;
DROP POLICY IF EXISTS "Receipt delete policy" ON storage.objects;

-- Create new secure policies for receipts bucket with unique names
CREATE POLICY "Receipt upload policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Receipt view policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Receipt delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');