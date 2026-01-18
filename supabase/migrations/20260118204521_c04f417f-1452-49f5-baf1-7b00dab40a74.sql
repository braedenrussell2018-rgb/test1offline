-- Protect user data from being deleted when user accounts are deleted
-- Change ON DELETE CASCADE to ON DELETE SET NULL for business data tables

-- 1. people table - preserve contacts when user is deleted
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_user_id_fkey;
ALTER TABLE public.people 
  ADD CONSTRAINT people_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. spiff_program table - preserve sales records when salesman is deleted
ALTER TABLE public.spiff_program DROP CONSTRAINT IF EXISTS spiff_program_salesman_id_fkey;
ALTER TABLE public.spiff_program 
  ADD CONSTRAINT spiff_program_salesman_id_fkey 
  FOREIGN KEY (salesman_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. profiles table - preserve profile data when user is deleted
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. ai_conversations - preserve AI conversation history
-- First check if the column has a constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'ai_conversations' AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey;
  END IF;
END $$;

-- Add SET NULL constraint if user_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_conversations' AND column_name = 'user_id'
  ) THEN
    -- Make user_id nullable if not already
    ALTER TABLE public.ai_conversations ALTER COLUMN user_id DROP NOT NULL;
    -- Add foreign key with SET NULL
    ALTER TABLE public.ai_conversations 
      ADD CONSTRAINT ai_conversations_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. internal_notes - preserve notes when user is deleted
DO $$
BEGIN
  -- Make user_id nullable
  ALTER TABLE public.internal_notes ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 6. company_meetings - preserve meeting records
DO $$
BEGIN
  -- Make created_by nullable
  ALTER TABLE public.company_meetings ALTER COLUMN created_by DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 7. invoices - preserve invoice records (created_by is already nullable via the constraint)

-- 8. Keep user_roles and user_security_settings with CASCADE since these are
-- user-specific settings that should be deleted when the user is deleted

-- 9. quickbooks_connections - these should be deleted when user is deleted (keep CASCADE)

-- 10. user_ai_settings - these should be deleted when user is deleted (keep CASCADE)

-- Add comment to document the data protection policy
COMMENT ON TABLE public.people IS 'Contact records - user_id uses SET NULL to preserve data when users are deleted';
COMMENT ON TABLE public.spiff_program IS 'Sales records - salesman_id uses SET NULL to preserve data when users are deleted';
COMMENT ON TABLE public.profiles IS 'User profiles - uses SET NULL to preserve historical data';
COMMENT ON TABLE public.ai_conversations IS 'AI conversation history - uses SET NULL to preserve data';
COMMENT ON TABLE public.internal_notes IS 'Internal notes - user_id nullable to preserve data when users are deleted';
COMMENT ON TABLE public.company_meetings IS 'Meeting records - created_by nullable to preserve data when users are deleted';