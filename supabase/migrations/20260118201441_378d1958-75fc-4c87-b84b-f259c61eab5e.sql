-- Add soft delete column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_people_deleted_at ON public.people(deleted_at) WHERE deleted_at IS NULL;

-- Create a view that shows only active (non-deleted) contacts
CREATE OR REPLACE VIEW public.active_people AS
SELECT * FROM public.people WHERE deleted_at IS NULL;

-- Create a function that converts DELETE to soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_people()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of deleting, set deleted_at timestamp
  UPDATE public.people 
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = OLD.id;
  
  -- Return NULL to prevent the actual DELETE
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to intercept DELETE operations
DROP TRIGGER IF EXISTS trigger_soft_delete_people ON public.people;
CREATE TRIGGER trigger_soft_delete_people
  BEFORE DELETE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete_people();

-- Create a function to permanently delete (only for developers/owners)
CREATE OR REPLACE FUNCTION public.permanently_delete_person(person_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if user has owner or developer role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'developer')
  ) THEN
    RAISE EXCEPTION 'Only owners and developers can permanently delete contacts';
  END IF;
  
  -- Disable the soft delete trigger temporarily
  ALTER TABLE public.people DISABLE TRIGGER trigger_soft_delete_people;
  
  -- Actually delete the record
  DELETE FROM public.people WHERE id = person_id;
  
  -- Re-enable the trigger
  ALTER TABLE public.people ENABLE TRIGGER trigger_soft_delete_people;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a function to restore soft-deleted contacts
CREATE OR REPLACE FUNCTION public.restore_person(person_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.people 
  SET deleted_at = NULL, updated_at = NOW()
  WHERE id = person_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;