
-- 1. Remove ambiguous has_role overload (app_role, uuid). RLS uses (uuid, app_role).
DROP FUNCTION IF EXISTS public.has_role(app_role, uuid);

-- 2. user_security_settings: restrict INSERT to self or owner/developer
CREATE POLICY "Users can insert own security settings"
ON public.user_security_settings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'developer'::app_role)
);

-- 3. audit_logs: block all client INSERTs (service role bypasses RLS)
CREATE POLICY "Block client inserts on audit_logs"
ON public.audit_logs AS RESTRICTIVE
FOR INSERT TO anon, authenticated
WITH CHECK (false);

-- 4. data_export_logs: only insert own rows
CREATE POLICY "Users can insert own export logs"
ON public.data_export_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. signup_notifications: block client inserts (trigger uses SECURITY DEFINER)
CREATE POLICY "Block client inserts on signup_notifications"
ON public.signup_notifications AS RESTRICTIVE
FOR INSERT TO anon, authenticated
WITH CHECK (false);

-- 6. Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated
-- These should only be invoked via RLS policies or trusted server-side code.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, app_role[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_global_developer(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_tenant(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_email(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_email(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.store_qb_tokens(uuid, text, text, text, timestamptz, timestamptz) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_qb_tokens(uuid, text, text, timestamptz, timestamptz) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_qb_tokens(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_qb_connection_status(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_account_status(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.permanently_delete_person(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_person(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_note_to_contact(uuid, text) FROM anon, PUBLIC;

-- Keep authenticated EXECUTE on functions intentionally called from the client via RPC
GRANT EXECUTE ON FUNCTION public.permanently_delete_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_note_to_contact(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_status(text) TO authenticated;

-- 7. Realtime: exclude salesmen from calendar_events realtime stream by adding a stricter policy.
-- The existing realtime policy checks is_tenant_member; we add a RESTRICTIVE policy that requires
-- the topic's tenant role to include calendar access.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'Restrict calendar_events realtime to non-salesman'
  ) THEN
    DROP POLICY "Restrict calendar_events realtime to non-salesman" ON realtime.messages;
  END IF;
END $$;

CREATE POLICY "Restrict calendar_events realtime to non-salesman"
ON realtime.messages AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  -- Only restrict topics that target the calendar_events table; allow others.
  CASE
    WHEN realtime.topic() LIKE '%calendar_events%' THEN
      EXISTS (
        SELECT 1 FROM public.tenant_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'active'
          AND tm.role = ANY(ARRAY['owner'::app_role, 'employee'::app_role, 'developer'::app_role])
      )
    ELSE true
  END
);
