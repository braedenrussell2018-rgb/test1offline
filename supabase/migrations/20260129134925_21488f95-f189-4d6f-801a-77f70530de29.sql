-- Fix inconsistent RLS policies: standardize to 'authenticated' role
-- This ensures policies only apply to logged-in users

-- spiff_program: Fix SELECT policy for internal users (currently uses public, should be authenticated)
DROP POLICY IF EXISTS "Internal users can view all spiff records" ON public.spiff_program;
CREATE POLICY "Internal users can view all spiff records" 
ON public.spiff_program FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- Also ensure all other internal policies are using authenticated role consistently
-- accounts
DROP POLICY IF EXISTS "Owners and developers can view accounts" ON public.accounts;
CREATE POLICY "Owners and developers can view accounts" ON public.accounts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can insert accounts" ON public.accounts;
CREATE POLICY "Owners and developers can insert accounts" ON public.accounts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can update accounts" ON public.accounts;
CREATE POLICY "Owners and developers can update accounts" ON public.accounts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete accounts" ON public.accounts;
CREATE POLICY "Owners and developers can delete accounts" ON public.accounts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- account_transactions
DROP POLICY IF EXISTS "Owners and developers can view transactions" ON public.account_transactions;
CREATE POLICY "Owners and developers can view transactions" ON public.account_transactions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can insert transactions" ON public.account_transactions;
CREATE POLICY "Owners and developers can insert transactions" ON public.account_transactions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can update transactions" ON public.account_transactions;
CREATE POLICY "Owners and developers can update transactions" ON public.account_transactions FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete transactions" ON public.account_transactions;
CREATE POLICY "Owners and developers can delete transactions" ON public.account_transactions FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- items
DROP POLICY IF EXISTS "Internal users can view items" ON public.items;
CREATE POLICY "Internal users can view items" ON public.items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert items" ON public.items;
CREATE POLICY "Internal users can insert items" ON public.items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update items" ON public.items;
CREATE POLICY "Internal users can update items" ON public.items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete items" ON public.items;
CREATE POLICY "Owners and developers can delete items" ON public.items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- people
DROP POLICY IF EXISTS "Internal users can view all contacts" ON public.people;
CREATE POLICY "Internal users can view all contacts" ON public.people FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert contacts" ON public.people;
CREATE POLICY "Internal users can insert contacts" ON public.people FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update contacts" ON public.people;
CREATE POLICY "Internal users can update contacts" ON public.people FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete contacts" ON public.people;
CREATE POLICY "Owners and developers can delete contacts" ON public.people FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- companies
DROP POLICY IF EXISTS "Internal users can view companies" ON public.companies;
CREATE POLICY "Internal users can view companies" ON public.companies FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert companies" ON public.companies;
CREATE POLICY "Internal users can insert companies" ON public.companies FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update companies" ON public.companies;
CREATE POLICY "Internal users can update companies" ON public.companies FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete companies" ON public.companies;
CREATE POLICY "Owners and developers can delete companies" ON public.companies FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- invoices
DROP POLICY IF EXISTS "Internal users can view all invoices" ON public.invoices;
CREATE POLICY "Internal users can view all invoices" ON public.invoices FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert invoices" ON public.invoices;
CREATE POLICY "Internal users can insert invoices" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update invoices" ON public.invoices;
CREATE POLICY "Internal users can update invoices" ON public.invoices FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete invoices" ON public.invoices;
CREATE POLICY "Owners and developers can delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- quotes
DROP POLICY IF EXISTS "Internal users can view quotes" ON public.quotes;
CREATE POLICY "Internal users can view quotes" ON public.quotes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert quotes" ON public.quotes;
CREATE POLICY "Internal users can insert quotes" ON public.quotes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update quotes" ON public.quotes;
CREATE POLICY "Internal users can update quotes" ON public.quotes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can delete quotes" ON public.quotes;
CREATE POLICY "Internal users can delete quotes" ON public.quotes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- expenses
DROP POLICY IF EXISTS "Internal users can view expenses" ON public.expenses;
CREATE POLICY "Internal users can view expenses" ON public.expenses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert expenses" ON public.expenses;
CREATE POLICY "Internal users can insert expenses" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update expenses" ON public.expenses;
CREATE POLICY "Internal users can update expenses" ON public.expenses FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete expenses" ON public.expenses;
CREATE POLICY "Owners and developers can delete expenses" ON public.expenses FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- vendors
DROP POLICY IF EXISTS "Internal users can view vendors" ON public.vendors;
CREATE POLICY "Internal users can view vendors" ON public.vendors FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert vendors" ON public.vendors;
CREATE POLICY "Internal users can insert vendors" ON public.vendors FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update vendors" ON public.vendors;
CREATE POLICY "Internal users can update vendors" ON public.vendors FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete vendors" ON public.vendors;
CREATE POLICY "Owners and developers can delete vendors" ON public.vendors FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- purchase_orders
DROP POLICY IF EXISTS "Internal users can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Internal users can view purchase orders" ON public.purchase_orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert purchase orders" ON public.purchase_orders;
CREATE POLICY "Internal users can insert purchase orders" ON public.purchase_orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update purchase orders" ON public.purchase_orders;
CREATE POLICY "Internal users can update purchase orders" ON public.purchase_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete purchase orders" ON public.purchase_orders;
CREATE POLICY "Owners and developers can delete purchase orders" ON public.purchase_orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- purchase_order_items
DROP POLICY IF EXISTS "Internal users can view PO items" ON public.purchase_order_items;
CREATE POLICY "Internal users can view PO items" ON public.purchase_order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert PO items" ON public.purchase_order_items;
CREATE POLICY "Internal users can insert PO items" ON public.purchase_order_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update PO items" ON public.purchase_order_items;
CREATE POLICY "Internal users can update PO items" ON public.purchase_order_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete PO items" ON public.purchase_order_items;
CREATE POLICY "Owners and developers can delete PO items" ON public.purchase_order_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- branches
DROP POLICY IF EXISTS "Internal users can view branches" ON public.branches;
CREATE POLICY "Internal users can view branches" ON public.branches FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert branches" ON public.branches;
CREATE POLICY "Internal users can insert branches" ON public.branches FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update branches" ON public.branches;
CREATE POLICY "Internal users can update branches" ON public.branches FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete branches" ON public.branches;
CREATE POLICY "Owners and developers can delete branches" ON public.branches FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- budget_forecasts
DROP POLICY IF EXISTS "Owners and developers can view forecasts" ON public.budget_forecasts;
CREATE POLICY "Owners and developers can view forecasts" ON public.budget_forecasts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can insert forecasts" ON public.budget_forecasts;
CREATE POLICY "Owners and developers can insert forecasts" ON public.budget_forecasts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can update forecasts" ON public.budget_forecasts;
CREATE POLICY "Owners and developers can update forecasts" ON public.budget_forecasts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can delete forecasts" ON public.budget_forecasts;
CREATE POLICY "Owners and developers can delete forecasts" ON public.budget_forecasts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- audit_logs
DROP POLICY IF EXISTS "Owners and developers can view audit logs" ON public.audit_logs;
CREATE POLICY "Owners and developers can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and developers can view all profiles" ON public.profiles;
CREATE POLICY "Owners and developers can view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and developers can view all roles" ON public.user_roles;
CREATE POLICY "Owners and developers can view all roles" ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Owners and developers can manage all roles" ON public.user_roles;
CREATE POLICY "Owners and developers can manage all roles" ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
CREATE POLICY "Users can insert their own role during signup" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- user_security_settings
DROP POLICY IF EXISTS "Users can view own security settings" ON public.user_security_settings;
CREATE POLICY "Users can view own security settings" ON public.user_security_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and developers can view all security settings" ON public.user_security_settings;
CREATE POLICY "Owners and developers can view all security settings" ON public.user_security_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Users can update own security settings" ON public.user_security_settings;
CREATE POLICY "Users can update own security settings" ON public.user_security_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and developers can update all security settings" ON public.user_security_settings;
CREATE POLICY "Owners and developers can update all security settings" ON public.user_security_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- ai_conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view their own conversations" ON public.ai_conversations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and developers can view all conversations" ON public.ai_conversations;
CREATE POLICY "Owners and developers can view all conversations" ON public.ai_conversations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can insert their own conversations" ON public.ai_conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can update their own conversations" ON public.ai_conversations FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can delete their own conversations" ON public.ai_conversations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- internal_notes
DROP POLICY IF EXISTS "Internal users can view notes" ON public.internal_notes;
CREATE POLICY "Internal users can view notes" ON public.internal_notes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert notes" ON public.internal_notes;
CREATE POLICY "Internal users can insert notes" ON public.internal_notes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update notes" ON public.internal_notes;
CREATE POLICY "Internal users can update notes" ON public.internal_notes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can delete notes" ON public.internal_notes;
CREATE POLICY "Internal users can delete notes" ON public.internal_notes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- company_meetings
DROP POLICY IF EXISTS "Internal users can view meetings" ON public.company_meetings;
CREATE POLICY "Internal users can view meetings" ON public.company_meetings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can insert meetings" ON public.company_meetings;
CREATE POLICY "Internal users can insert meetings" ON public.company_meetings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can update meetings" ON public.company_meetings;
CREATE POLICY "Internal users can update meetings" ON public.company_meetings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

DROP POLICY IF EXISTS "Internal users can delete meetings" ON public.company_meetings;
CREATE POLICY "Internal users can delete meetings" ON public.company_meetings FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

-- user_ai_settings
DROP POLICY IF EXISTS "Users can view their own AI settings" ON public.user_ai_settings;
CREATE POLICY "Users can view their own AI settings" ON public.user_ai_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own AI settings" ON public.user_ai_settings;
CREATE POLICY "Users can insert their own AI settings" ON public.user_ai_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own AI settings" ON public.user_ai_settings;
CREATE POLICY "Users can update their own AI settings" ON public.user_ai_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);