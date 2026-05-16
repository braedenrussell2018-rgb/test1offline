
-- 1. Remove open tenant self-enrollment (privilege escalation risk)
DROP POLICY IF EXISTS "Self insert pending customer membership" ON public.tenant_members;

-- 2. user_security_settings: restrict user UPDATE to last_activity only via trigger
DROP POLICY IF EXISTS "Users can update own activity timestamp" ON public.user_security_settings;
CREATE POLICY "Users can update own activity timestamp"
ON public.user_security_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure protective trigger exists (was missing)
DROP TRIGGER IF EXISTS protect_user_security_settings ON public.user_security_settings;
CREATE TRIGGER protect_user_security_settings
BEFORE UPDATE ON public.user_security_settings
FOR EACH ROW EXECUTE FUNCTION public.protect_user_security_settings();

-- 3. audio-recordings: admin SELECT/DELETE
DROP POLICY IF EXISTS "Owners and developers can view all audio" ON storage.objects;
CREATE POLICY "Owners and developers can view all audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'developer'::app_role))
);

DROP POLICY IF EXISTS "Owners and developers can delete audio" ON storage.objects;
CREATE POLICY "Owners and developers can delete audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'developer'::app_role))
);

-- 4. calendar_event_invitees: scope to tenant via parent event
DROP POLICY IF EXISTS "Internal users can view calendar invitees" ON public.calendar_event_invitees;
CREATE POLICY "Tenant members can view calendar invitees"
ON public.calendar_event_invitees FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_events ce
    WHERE ce.id = calendar_event_invitees.event_id
      AND public.is_tenant_member(ce.tenant_id, auth.uid())
  )
);

-- 5. spiff_program & spiff_warranties: salesman sees only own records
DROP POLICY IF EXISTS "Tenant members view spiff_program" ON public.spiff_program;
CREATE POLICY "Tenant members view spiff_program"
ON public.spiff_program FOR SELECT TO authenticated
USING (
  (salesman_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()))
  OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::app_role, 'employee'::app_role, 'developer'::app_role])
);

DROP POLICY IF EXISTS "Tenant members view spiff_warranties" ON public.spiff_warranties;
CREATE POLICY "Tenant members view spiff_warranties"
ON public.spiff_warranties FOR SELECT TO authenticated
USING (
  (salesman_id = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()))
  OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::app_role, 'employee'::app_role, 'developer'::app_role])
);

-- 6. Revoke EXECUTE on internal SECURITY DEFINER helpers not meant to be client-callable
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_email(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_email(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.store_qb_tokens(uuid, text, text, text, timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_qb_tokens(uuid, text, text, timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_qb_tokens(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_security() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_signup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_employee_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_people() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_meeting_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_security_settings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_account_status(text) FROM anon, authenticated;
