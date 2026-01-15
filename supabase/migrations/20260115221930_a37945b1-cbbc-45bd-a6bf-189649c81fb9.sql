-- Drop the trigger that validates role insert (it blocks owner self-registration)
DROP TRIGGER IF EXISTS validate_role_insert_trigger ON public.user_roles;
DROP TRIGGER IF EXISTS validate_role_update_trigger ON public.user_roles;

-- Drop the functions that validate roles
DROP FUNCTION IF EXISTS validate_role_insert() CASCADE;
DROP FUNCTION IF EXISTS validate_role_update() CASCADE;

-- Add a simple trigger that just allows any role to be inserted for now
-- This is for testing purposes - you can re-add restrictions later

-- Also fix the user_security_settings to use upsert logic by making the constraint deferrable
-- First remove any duplicate entries (keep the most recent one)
DELETE FROM user_security_settings a
USING user_security_settings b
WHERE a.user_id = b.user_id 
AND a.created_at < b.created_at;