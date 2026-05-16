
-- 1. tenant_members: restrict self-insert to pending customer role only
DROP POLICY IF EXISTS "Self insert pending membership" ON public.tenant_members;
CREATE POLICY "Self insert pending customer membership"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'customer'::app_role
  AND status = 'pending'::tenant_member_status
);

-- 2. video_meeting_participants: tenant-scoped visibility
DROP POLICY IF EXISTS "Authenticated users can view participants" ON public.video_meeting_participants;
CREATE POLICY "Tenant members can view meeting participants"
ON public.video_meeting_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.video_meetings vm
    WHERE vm.id = video_meeting_participants.meeting_id
      AND public.is_tenant_member(vm.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can join meetings" ON public.video_meeting_participants;
CREATE POLICY "Tenant members can join meetings"
ON public.video_meeting_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.video_meetings vm
    WHERE vm.id = video_meeting_participants.meeting_id
      AND public.is_tenant_member(vm.tenant_id, auth.uid())
  )
);

-- 3. Storage: meeting-recordings tenant scoping (path convention: <tenant_id>/<meeting_id>/<file>)
DROP POLICY IF EXISTS "Authenticated users can view recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recordings" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can view meeting recordings" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload meeting recordings" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can update meeting recordings" ON storage.objects;
DROP POLICY IF EXISTS "Tenant owners can delete meeting recordings" ON storage.objects;

CREATE POLICY "Tenant members can view meeting recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'meeting-recordings'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Tenant members can upload meeting recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meeting-recordings'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Tenant members can update meeting recordings"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'meeting-recordings'
  AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Tenant owners can delete meeting recordings"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meeting-recordings'
  AND public.has_tenant_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['owner'::app_role, 'developer'::app_role])
);

-- 4. Realtime: require topic to be scoped to caller's tenant ("tenant:<tenant_id>:...")
DROP POLICY IF EXISTS "Internal tenant members can receive realtime" ON realtime.messages;
CREATE POLICY "Tenant-scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_global_developer(auth.uid())
  OR (
    realtime.topic() LIKE 'tenant:%'
    AND public.is_tenant_member(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  )
);
