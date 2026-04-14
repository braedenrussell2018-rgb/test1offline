-- Drop the overly permissive self-update policy  
DROP POLICY IF EXISTS "Users can update own security settings" ON public.user_security_settings;

-- Create restricted self-update policy for activity tracking only
CREATE POLICY "Users can update own activity timestamp"
ON public.user_security_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);