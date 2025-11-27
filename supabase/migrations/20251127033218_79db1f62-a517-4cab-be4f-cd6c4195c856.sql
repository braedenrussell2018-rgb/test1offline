-- Drop existing RLS policies on people table
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.people;
DROP POLICY IF EXISTS "Users can create their own contacts" ON public.people;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.people;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.people;

-- Create new RLS policies for people - all authenticated users can view all contacts
CREATE POLICY "Authenticated users can view all contacts"
ON public.people
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only the owner can create contacts (assigned to them)
CREATE POLICY "Users can create their own contacts"
ON public.people
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their contacts
CREATE POLICY "Users can update their own contacts"
ON public.people
FOR UPDATE
USING (auth.uid() = user_id);

-- Only the owner can delete their contacts
CREATE POLICY "Users can delete their own contacts"
ON public.people
FOR DELETE
USING (auth.uid() = user_id);

-- Create a security definer function to allow any authenticated user to add notes to any contact
CREATE OR REPLACE FUNCTION public.add_note_to_contact(
  p_person_id uuid,
  p_note_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Get current notes
  SELECT COALESCE(notes, '[]'::jsonb) INTO v_current_notes
  FROM public.people
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- Append new note to existing notes array
  UPDATE public.people
  SET notes = v_current_notes || v_new_note,
      updated_at = now()
  WHERE id = p_person_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.add_note_to_contact(uuid, text) TO authenticated;