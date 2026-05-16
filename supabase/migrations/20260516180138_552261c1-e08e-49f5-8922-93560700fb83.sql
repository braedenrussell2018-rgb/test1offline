
-- ============================================================
-- Multi-tenant registry
-- ============================================================

-- Tenants (a.k.a. customer companies on the platform).
-- Named `tenants` to avoid clashing with the existing CRM `companies` table.
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_by uuid,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.tenant_member_status AS ENUM ('active', 'pending', 'invited', 'revoked');

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  status public.tenant_member_status NOT NULL DEFAULT 'active',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);

CREATE TABLE public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  email text,
  role public.app_role NOT NULL DEFAULT 'employee',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  used_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_invites_tenant ON public.tenant_invites(tenant_id);

-- Profiles: track active tenant context per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- ============================================================
-- Security definer helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_global_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'developer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = _user_id
      AND status = 'active'
  ) OR public.is_global_developer(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = _user_id
      AND status = 'active'
      AND role = ANY(_roles)
  ) OR public.is_global_developer(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Convenience: can the caller WRITE in the given tenant (any active membership counts as a generic gate)?
-- Specific tables further restrict by role.
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _tenant_id IS NOT NULL AND public.is_tenant_member(_tenant_id, auth.uid());
$$;

-- ============================================================
-- RLS on registry tables
-- ============================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- tenants: members can see their own; developer sees all; creator can update (rename); developer can update anything
CREATE POLICY "Members can view their tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create a tenant"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and developer can update tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_tenant_role(id, auth.uid(), ARRAY['owner']::public.app_role[]));

CREATE POLICY "Developer can delete tenant"
  ON public.tenants FOR DELETE TO authenticated
  USING (public.is_global_developer(auth.uid()));

-- tenant_members
CREATE POLICY "Users can view memberships in their tenants"
  ON public.tenant_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_member(tenant_id, auth.uid())
  );

CREATE POLICY "Self insert pending membership"
  ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners and developer can manage members"
  ON public.tenant_members FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.app_role[]));

CREATE POLICY "Owners and developer can remove members"
  ON public.tenant_members FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.app_role[]));

-- tenant_invites
CREATE POLICY "Owners and developer can view invites"
  ON public.tenant_invites FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.app_role[]));

CREATE POLICY "Owners and developer can create invites"
  ON public.tenant_invites FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.app_role[])
    AND created_by = auth.uid()
  );

CREATE POLICY "Owners and developer can revoke invites"
  ON public.tenant_invites FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.app_role[]));

-- Triggers
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tenant_members_updated_at BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
