
-- 1) Update realtime restrictive policy to also cover calendar_event_invitees
DROP POLICY IF EXISTS "Restrict calendar_events realtime to non-salesman" ON realtime.messages;

CREATE POLICY "Restrict calendar_events realtime to non-salesman"
ON realtime.messages AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE '%calendar_events%'
      OR realtime.topic() LIKE '%calendar_event_invitees%' THEN
      EXISTS (
        SELECT 1 FROM public.tenant_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'active'
          AND tm.role = ANY(ARRAY['owner'::app_role, 'employee'::app_role, 'developer'::app_role])
      )
    ELSE true
  END
);

-- 2) Tighten spiff_program INSERT policies
DROP POLICY IF EXISTS "Tenant internal insert spiff_program" ON public.spiff_program;

-- Owners/employees/developers can insert, but salesman_id must be an active member of the tenant
CREATE POLICY "Tenant staff insert spiff_program"
ON public.spiff_program
FOR INSERT
TO authenticated
WITH CHECK (
  has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::app_role, 'employee'::app_role, 'developer'::app_role])
  AND EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = spiff_program.tenant_id
      AND tm.user_id = spiff_program.salesman_id
      AND tm.status = 'active'
  )
);

-- Salesmen may self-report only entries attributed to themselves
CREATE POLICY "Salesman self insert spiff_program"
ON public.spiff_program
FOR INSERT
TO authenticated
WITH CHECK (
  salesman_id = auth.uid()
  AND is_tenant_member(tenant_id, auth.uid())
);
