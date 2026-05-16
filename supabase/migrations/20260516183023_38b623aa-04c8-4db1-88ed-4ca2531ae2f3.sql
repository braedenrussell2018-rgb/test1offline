
-- Explicitly deny any INSERT from anon/authenticated roles.
-- The security-check edge function uses the service role, which bypasses RLS.
CREATE POLICY "Block client inserts on login_attempts"
ON public.login_attempts
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);
