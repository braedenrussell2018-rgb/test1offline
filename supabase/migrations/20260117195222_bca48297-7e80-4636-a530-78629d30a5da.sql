-- Add developer role to all RLS policies where owner has access

-- ============ purchase_orders ============
DROP POLICY IF EXISTS "Only owners can delete purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and employees can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and employees can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and employees can view purchase orders" ON public.purchase_orders;

CREATE POLICY "Internal users can view purchase orders" ON public.purchase_orders FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert purchase orders" ON public.purchase_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update purchase orders" ON public.purchase_orders FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete purchase orders" ON public.purchase_orders FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ budget_forecasts ============
DROP POLICY IF EXISTS "Only owners can delete forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Only owners can insert forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Only owners can update forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Only owners can view forecasts" ON public.budget_forecasts;

CREATE POLICY "Owners and developers can view forecasts" ON public.budget_forecasts FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can insert forecasts" ON public.budget_forecasts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can update forecasts" ON public.budget_forecasts FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete forecasts" ON public.budget_forecasts FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ quotes ============
DROP POLICY IF EXISTS "Only owners can delete any quote" ON public.quotes;
DROP POLICY IF EXISTS "Owners and employees can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Owners and employees can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Owners and employees can view all quotes" ON public.quotes;

CREATE POLICY "Internal users can view all quotes" ON public.quotes FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert quotes" ON public.quotes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update quotes" ON public.quotes FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete any quote" ON public.quotes FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ invoices ============
DROP POLICY IF EXISTS "Only owners can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners and employees can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners and employees can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners and employees can view all invoices" ON public.invoices;

CREATE POLICY "Internal users can view all invoices" ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert invoices" ON public.invoices FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update invoices" ON public.invoices FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete invoices" ON public.invoices FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ expenses ============
DROP POLICY IF EXISTS "Only owners can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and employees can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and employees can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and employees can view expenses" ON public.expenses;

CREATE POLICY "Internal users can view expenses" ON public.expenses FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert expenses" ON public.expenses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update expenses" ON public.expenses FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete expenses" ON public.expenses FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ items ============
DROP POLICY IF EXISTS "Only owners can delete items" ON public.items;
DROP POLICY IF EXISTS "Owners and employees can insert items" ON public.items;
DROP POLICY IF EXISTS "Owners and employees can update items" ON public.items;
DROP POLICY IF EXISTS "Owners and employees can view items" ON public.items;

CREATE POLICY "Internal users can view items" ON public.items FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert items" ON public.items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update items" ON public.items FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete items" ON public.items FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ accounts ============
DROP POLICY IF EXISTS "Only owners can delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Only owners can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Only owners can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Only owners can view accounts" ON public.accounts;

CREATE POLICY "Owners and developers can view accounts" ON public.accounts FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can insert accounts" ON public.accounts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can update accounts" ON public.accounts FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete accounts" ON public.accounts FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ account_transactions ============
DROP POLICY IF EXISTS "Only owners can delete transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Only owners can insert transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Only owners can update transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Only owners can view transactions" ON public.account_transactions;

CREATE POLICY "Owners and developers can view transactions" ON public.account_transactions FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can insert transactions" ON public.account_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can update transactions" ON public.account_transactions FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete transactions" ON public.account_transactions FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ companies ============
DROP POLICY IF EXISTS "Only owners can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Owners and employees can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Owners and employees can update companies" ON public.companies;
DROP POLICY IF EXISTS "Owners and employees can view companies" ON public.companies;

CREATE POLICY "Internal users can view companies" ON public.companies FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert companies" ON public.companies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update companies" ON public.companies FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete companies" ON public.companies FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ branches ============
DROP POLICY IF EXISTS "Only owners can delete branches" ON public.branches;
DROP POLICY IF EXISTS "Owners and employees can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Owners and employees can update branches" ON public.branches;
DROP POLICY IF EXISTS "Owners and employees can view branches" ON public.branches;

CREATE POLICY "Internal users can view branches" ON public.branches FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert branches" ON public.branches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update branches" ON public.branches FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete branches" ON public.branches FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ purchase_order_items ============
DROP POLICY IF EXISTS "Only owners can delete PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Owners and employees can insert PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Owners and employees can update PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Owners and employees can view PO items" ON public.purchase_order_items;

CREATE POLICY "Internal users can view PO items" ON public.purchase_order_items FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can insert PO items" ON public.purchase_order_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can update PO items" ON public.purchase_order_items FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can delete PO items" ON public.purchase_order_items FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ audit_logs ============
DROP POLICY IF EXISTS "Only owners can view audit logs" ON public.audit_logs;

CREATE POLICY "Owners and developers can view audit logs" ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ login_attempts ============
DROP POLICY IF EXISTS "Only owners can view login attempts" ON public.login_attempts;

CREATE POLICY "Owners and developers can view login attempts" ON public.login_attempts FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ data_export_logs ============
DROP POLICY IF EXISTS "Only owners can view export logs" ON public.data_export_logs;

CREATE POLICY "Owners and developers can view export logs" ON public.data_export_logs FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ user_roles ============
DROP POLICY IF EXISTS "Owners can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view all roles" ON public.user_roles;

CREATE POLICY "Owners and developers can manage all roles" ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can view all roles" ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ user_security_settings ============
DROP POLICY IF EXISTS "Owners can update all security settings" ON public.user_security_settings;
DROP POLICY IF EXISTS "Owners can view all security settings" ON public.user_security_settings;

CREATE POLICY "Owners and developers can view all security settings" ON public.user_security_settings FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Owners and developers can update all security settings" ON public.user_security_settings FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ profiles ============
DROP POLICY IF EXISTS "Owners can view all profiles" ON public.profiles;

CREATE POLICY "Owners and developers can view all profiles" ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ internal_notes ============
DROP POLICY IF EXISTS "Owners can view all internal notes" ON public.internal_notes;

CREATE POLICY "Owners and developers can view all internal notes" ON public.internal_notes FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner'::app_role, 'developer'::app_role)));

-- ============ company_meetings ============
DROP POLICY IF EXISTS "Internal users can view meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Creators and owners can update meetings" ON public.company_meetings;
DROP POLICY IF EXISTS "Creators and owners can delete meetings" ON public.company_meetings;

CREATE POLICY "Internal users can view meetings" ON public.company_meetings FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner'::app_role, 'employee'::app_role, 'developer'::app_role)));

CREATE POLICY "Internal users can create meetings" ON public.company_meetings FOR INSERT
WITH CHECK ((auth.uid() = created_by) AND EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner'::app_role, 'employee'::app_role, 'developer'::app_role)));

CREATE POLICY "Creators owners and developers can update meetings" ON public.company_meetings FOR UPDATE
USING ((auth.uid() = created_by) OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner'::app_role, 'developer'::app_role)));

CREATE POLICY "Creators owners and developers can delete meetings" ON public.company_meetings FOR DELETE
USING ((auth.uid() = created_by) OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner'::app_role, 'developer'::app_role)));

-- ============ spiff_program ============
DROP POLICY IF EXISTS "Owners can manage all spiff records" ON public.spiff_program;
DROP POLICY IF EXISTS "Owners can view all spiff records" ON public.spiff_program;

CREATE POLICY "Owners and developers can manage all spiff records" ON public.spiff_program FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Internal users can view all spiff records" ON public.spiff_program FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ============ spiff_prizes ============
DROP POLICY IF EXISTS "Owners can manage prizes" ON public.spiff_prizes;

CREATE POLICY "Owners and developers can manage prizes" ON public.spiff_prizes FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));