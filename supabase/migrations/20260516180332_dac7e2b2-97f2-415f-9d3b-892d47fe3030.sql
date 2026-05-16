
-- ============================================================
-- 1. Create the "TRUE" tenant and seed memberships
-- ============================================================
DO $$
DECLARE
  v_tenant_id uuid;
  v_first_owner uuid;
BEGIN
  -- Pick an existing owner/developer as the creator, fallback to any user
  SELECT user_id INTO v_first_owner
  FROM public.user_roles
  WHERE role IN ('owner', 'developer')
  ORDER BY role
  LIMIT 1;

  IF v_first_owner IS NULL THEN
    SELECT id INTO v_first_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  INSERT INTO public.tenants (slug, name, created_by)
  VALUES ('true', 'TRUE Attachments', v_first_owner)
  RETURNING id INTO v_tenant_id;

  -- Membership: copy every existing user_roles row
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  SELECT v_tenant_id, ur.user_id, ur.role, 'active'::tenant_member_status
  FROM public.user_roles ur
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- Also make sure every existing profile is at least a member (default 'employee') if missing
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  SELECT v_tenant_id, p.user_id, 'employee'::app_role, 'active'::tenant_member_status
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = v_tenant_id AND tm.user_id = p.user_id
  );

  -- Point every profile at TRUE
  UPDATE public.profiles SET current_tenant_id = v_tenant_id WHERE current_tenant_id IS NULL;
END $$;

-- ============================================================
-- 2. Add tenant_id to every business table and backfill to TRUE
-- ============================================================
DO $$
DECLARE
  v_tenant_id uuid;
  t text;
  tables text[] := ARRAY[
    'people','companies','branches','items','invoices','quotes',
    'purchase_orders','purchase_order_items','expenses',
    'accounts','account_transactions','budget_forecasts',
    'ai_conversations','calendar_events','internal_notes',
    'company_meetings','video_meetings','vendors',
    'spiff_prizes','spiff_program','spiff_warranties'
  ];
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug='true';

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, v_tenant_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 3. Drop legacy role-based policies, add tenant-scoped ones
-- ============================================================

-- Helper macro pattern: we drop ALL policies on each table then recreate.
-- Done explicitly per-table for clarity.

-- ---------- people ----------
DROP POLICY IF EXISTS "Customers can view their own contact" ON public.people;
DROP POLICY IF EXISTS "Internal users can insert contacts" ON public.people;
DROP POLICY IF EXISTS "Internal users can update contacts" ON public.people;
DROP POLICY IF EXISTS "Internal users can view all contacts" ON public.people;
DROP POLICY IF EXISTS "Owners and developers can delete contacts" ON public.people;

CREATE POLICY "Tenant members can view contacts" ON public.people
  FOR SELECT TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert contacts" ON public.people
  FOR INSERT TO authenticated
  WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update contacts" ON public.people
  FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete contacts" ON public.people
  FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- companies (CRM) ----------
DROP POLICY IF EXISTS "Internal users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Internal users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Internal users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Owners and developers can delete companies" ON public.companies;

CREATE POLICY "Tenant members can view companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- branches ----------
DROP POLICY IF EXISTS "Internal users can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Internal users can update branches" ON public.branches;
DROP POLICY IF EXISTS "Internal users can view branches" ON public.branches;
DROP POLICY IF EXISTS "Owners and developers can delete branches" ON public.branches;

CREATE POLICY "Tenant members can view branches" ON public.branches
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert branches" ON public.branches
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update branches" ON public.branches
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete branches" ON public.branches
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- items ----------
DROP POLICY IF EXISTS "Internal users can insert items" ON public.items;
DROP POLICY IF EXISTS "Internal users can update items" ON public.items;
DROP POLICY IF EXISTS "Internal users can view items" ON public.items;
DROP POLICY IF EXISTS "Owners and developers can delete items" ON public.items;

CREATE POLICY "Tenant members can view items" ON public.items
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update items" ON public.items
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete items" ON public.items
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- invoices ----------
DROP POLICY IF EXISTS "Internal users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Internal users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Internal users can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners and developers can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Salesmen can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Salesmen can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Salesmen can view their own invoices" ON public.invoices;

CREATE POLICY "Tenant internal can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can view own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant internal can insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can insert own invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant internal can update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can update own invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant owners can delete invoices" ON public.invoices
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- quotes ----------
DROP POLICY IF EXISTS "Internal users can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Internal users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Internal users can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Internal users can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Salesmen can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Salesmen can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Salesmen can view own quotes" ON public.quotes;

CREATE POLICY "Tenant internal can view quotes" ON public.quotes
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can view own quotes" ON public.quotes
  FOR SELECT TO authenticated USING (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant internal can insert quotes" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can insert own quotes" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant internal can update quotes" ON public.quotes
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant salesman can update own quotes" ON public.quotes
  FOR UPDATE TO authenticated USING (
    has_tenant_role(tenant_id, auth.uid(), ARRAY['salesman']::app_role[])
    AND salesman_name = (SELECT full_name FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Tenant internal can delete quotes" ON public.quotes
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));

-- ---------- purchase_orders ----------
DROP POLICY IF EXISTS "Internal users can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Internal users can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Internal users can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and developers can delete purchase orders" ON public.purchase_orders;

CREATE POLICY "Tenant members can view POs" ON public.purchase_orders
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert POs" ON public.purchase_orders
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update POs" ON public.purchase_orders
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete POs" ON public.purchase_orders
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- purchase_order_items ----------
DROP POLICY IF EXISTS "Internal users can insert PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Internal users can update PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Internal users can view PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Owners and developers can delete PO items" ON public.purchase_order_items;

CREATE POLICY "Tenant members can view PO items" ON public.purchase_order_items
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert PO items" ON public.purchase_order_items
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update PO items" ON public.purchase_order_items
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete PO items" ON public.purchase_order_items
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- expenses ----------
DROP POLICY IF EXISTS "Internal users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Internal users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Internal users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and developers can delete expenses" ON public.expenses;

CREATE POLICY "Tenant members can view expenses" ON public.expenses
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can update expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners can delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- accounts ----------
DROP POLICY IF EXISTS "Owners and developers can delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners and developers can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners and developers can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Owners and developers can view accounts" ON public.accounts;

CREATE POLICY "Tenant owners can view accounts" ON public.accounts
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can insert accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can update accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can delete accounts" ON public.accounts
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- account_transactions ----------
DROP POLICY IF EXISTS "Owners and developers can delete transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Owners and developers can insert transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Owners and developers can update transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Owners and developers can view transactions" ON public.account_transactions;

CREATE POLICY "Tenant owners can view transactions" ON public.account_transactions
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can insert transactions" ON public.account_transactions
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can update transactions" ON public.account_transactions
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can delete transactions" ON public.account_transactions
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- budget_forecasts ----------
DROP POLICY IF EXISTS "Owners and developers can delete forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Owners and developers can insert forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Owners and developers can update forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Owners and developers can view forecasts" ON public.budget_forecasts;

CREATE POLICY "Tenant owners can view forecasts" ON public.budget_forecasts
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can insert forecasts" ON public.budget_forecasts
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can update forecasts" ON public.budget_forecasts
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "Tenant owners can delete forecasts" ON public.budget_forecasts
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- ai_conversations ----------
DROP POLICY IF EXISTS "Owners and developers can view all conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;

CREATE POLICY "User can view own AI conversations" ON public.ai_conversations
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    AND is_tenant_member(tenant_id, auth.uid())
  );
CREATE POLICY "Tenant owners can view all AI conversations" ON public.ai_conversations
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "User can insert own AI conversations" ON public.ai_conversations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND is_tenant_member(tenant_id, auth.uid())
  );
CREATE POLICY "User can update own AI conversations" ON public.ai_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "User can delete own AI conversations" ON public.ai_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));

-- ---------- calendar_events ----------
DROP POLICY IF EXISTS "Internal users can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal users can view all calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update their own calendar events" ON public.calendar_events;

CREATE POLICY "Tenant members can view calendar" ON public.calendar_events
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members can insert calendar" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by
    AND has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[])
  );
CREATE POLICY "Creator can update calendar" ON public.calendar_events
  FOR UPDATE TO authenticated USING (
    auth.uid() = created_by AND is_tenant_member(tenant_id, auth.uid())
  );
CREATE POLICY "Creator can delete calendar" ON public.calendar_events
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by AND is_tenant_member(tenant_id, auth.uid())
  );

-- ---------- internal_notes ----------
DROP POLICY IF EXISTS "Internal users can delete notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Internal users can insert notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Internal users can update notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Internal users can view notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Owners and developers can view all internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Users can create their own internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Users can delete their own internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Users can update their own internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Users can view their own internal notes" ON public.internal_notes;

CREATE POLICY "User can view own notes" ON public.internal_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant owners can view all notes" ON public.internal_notes
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));
CREATE POLICY "User can insert own notes" ON public.internal_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "User can update own notes" ON public.internal_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "User can delete own notes" ON public.internal_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_tenant_member(tenant_id, auth.uid()));

-- ---------- company_meetings ----------
DROP POLICY IF EXISTS "Creators owners and developers can delete meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Creators owners and developers can update meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Internal users can create meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Internal users can delete meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Internal users can insert meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Internal users can update meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Internal users can view meetings" ON public.company_meetings;

CREATE POLICY "Tenant members view meetings" ON public.company_meetings
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members insert meetings" ON public.company_meetings
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members update meetings" ON public.company_meetings
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members delete meetings" ON public.company_meetings
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));

-- ---------- video_meetings ----------
-- Drop any existing policies; keep simple tenant scope
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='video_meetings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.video_meetings', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Tenant members view video meetings" ON public.video_meetings
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members insert video meetings" ON public.video_meetings
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members update video meetings" ON public.video_meetings
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members delete video meetings" ON public.video_meetings
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));

-- ---------- vendors ----------
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vendors' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vendors', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members view vendors" ON public.vendors
  FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members insert vendors" ON public.vendors
  FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant members update vendors" ON public.vendors
  FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]));
CREATE POLICY "Tenant owners delete vendors" ON public.vendors
  FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]));

-- ---------- spiff tables ----------
DO $$ DECLARE p record; tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['spiff_prizes','spiff_program','spiff_warranties'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format($f$CREATE POLICY "Tenant members view %1$s" ON public.%1$I FOR SELECT TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer','salesman']::app_role[]))$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Tenant internal insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]))$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Tenant internal update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner','employee','developer']::app_role[]))$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Tenant owners delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::app_role[]))$f$, tbl);
  END LOOP;
END $$;

-- ============================================================
-- 4. Update the new-user signup trigger:
-- no automatic global role; users get a tenant role when they create or join a tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Just create the profile. No global role assignment on self-signup.
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Also disable the legacy default-employee-role trigger if present
DROP TRIGGER IF EXISTS on_auth_user_created_default_employee ON auth.users;
