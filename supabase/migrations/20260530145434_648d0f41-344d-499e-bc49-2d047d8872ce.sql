
-- Lock down tenant creation to global developers only
DROP POLICY IF EXISTS "Authenticated users can create a tenant" ON public.tenants;
CREATE POLICY "Only global developers can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (public.is_global_developer(auth.uid()));

-- Lock down tenant_members INSERT — only owners of the tenant or global developers may add members
CREATE POLICY "Only tenant owners or developers can add members"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_global_developer(auth.uid())
  OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::app_role])
);
