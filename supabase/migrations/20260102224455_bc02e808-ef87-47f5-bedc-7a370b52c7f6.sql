-- =====================================================
-- COMPREHENSIVE RLS SECURITY FIX MIGRATION
-- Restricts data access based on user roles:
-- - Owners: Full access to all data
-- - Employees: Full access to operational data
-- - Salesmen: Only their own quotes/invoices/spiff records
-- - Customers: Only their linked contact data
-- =====================================================

-- ===========================================
-- 1. FIX PEOPLE TABLE (Business Contacts PII)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all contacts" ON public.people;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.people;
DROP POLICY IF EXISTS "Users can create their own contacts" ON public.people;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.people;

-- Only owners and employees can view all contacts
CREATE POLICY "Owners and employees can view all contacts"
ON public.people FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners and employees can insert contacts
CREATE POLICY "Owners and employees can insert contacts"
ON public.people FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners and employees can update contacts
CREATE POLICY "Owners and employees can update contacts"
ON public.people FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete contacts
CREATE POLICY "Only owners can delete contacts"
ON public.people FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- Customers can view their own linked contact record
CREATE POLICY "Customers can view their own contact"
ON public.people FOR SELECT
USING (has_role(auth.uid(), 'customer') AND user_id = auth.uid());

-- ===========================================
-- 2. FIX VENDORS TABLE (Vendor PII)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated users can insert vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated users can update vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated users can delete vendors" ON public.vendors;

-- Only owners and employees can view vendors
CREATE POLICY "Owners and employees can view vendors"
ON public.vendors FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners and employees can insert vendors
CREATE POLICY "Owners and employees can insert vendors"
ON public.vendors FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners and employees can update vendors
CREATE POLICY "Owners and employees can update vendors"
ON public.vendors FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete vendors
CREATE POLICY "Only owners can delete vendors"
ON public.vendors FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 3. FIX ACCOUNTS TABLE (Financial Data)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON public.accounts;

-- Only owners can view accounts (chart of accounts is sensitive)
CREATE POLICY "Only owners can view accounts"
ON public.accounts FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Only owners can insert accounts
CREATE POLICY "Only owners can insert accounts"
ON public.accounts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'));

-- Only owners can update accounts
CREATE POLICY "Only owners can update accounts"
ON public.accounts FOR UPDATE
USING (has_role(auth.uid(), 'owner'));

-- Only owners can delete accounts
CREATE POLICY "Only owners can delete accounts"
ON public.accounts FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 4. FIX ACCOUNT_TRANSACTIONS TABLE (Financial Data)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON public.account_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON public.account_transactions;

-- Only owners can view transactions
CREATE POLICY "Only owners can view transactions"
ON public.account_transactions FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Only owners can insert transactions
CREATE POLICY "Only owners can insert transactions"
ON public.account_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'));

-- Only owners can update transactions
CREATE POLICY "Only owners can update transactions"
ON public.account_transactions FOR UPDATE
USING (has_role(auth.uid(), 'owner'));

-- Only owners can delete transactions
CREATE POLICY "Only owners can delete transactions"
ON public.account_transactions FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 5. FIX BUDGET_FORECASTS TABLE (Financial Data)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Authenticated users can insert forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Authenticated users can update forecasts" ON public.budget_forecasts;
DROP POLICY IF EXISTS "Authenticated users can delete forecasts" ON public.budget_forecasts;

-- Only owners can view forecasts
CREATE POLICY "Only owners can view forecasts"
ON public.budget_forecasts FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Only owners can insert forecasts
CREATE POLICY "Only owners can insert forecasts"
ON public.budget_forecasts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'));

-- Only owners can update forecasts
CREATE POLICY "Only owners can update forecasts"
ON public.budget_forecasts FOR UPDATE
USING (has_role(auth.uid(), 'owner'));

-- Only owners can delete forecasts
CREATE POLICY "Only owners can delete forecasts"
ON public.budget_forecasts FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 6. FIX ITEMS TABLE (Inventory with pricing)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users can insert items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users can update items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users can delete items" ON public.items;

-- Owners and employees can view all items
CREATE POLICY "Owners and employees can view items"
ON public.items FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can insert items
CREATE POLICY "Owners and employees can insert items"
ON public.items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can update items
CREATE POLICY "Owners and employees can update items"
ON public.items FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete items
CREATE POLICY "Only owners can delete items"
ON public.items FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 7. FIX PURCHASE_ORDERS TABLE (Supplier data)
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can delete purchase orders" ON public.purchase_orders;

-- Owners and employees can view purchase orders
CREATE POLICY "Owners and employees can view purchase orders"
ON public.purchase_orders FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can insert purchase orders
CREATE POLICY "Owners and employees can insert purchase orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can update purchase orders
CREATE POLICY "Owners and employees can update purchase orders"
ON public.purchase_orders FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete purchase orders
CREATE POLICY "Only owners can delete purchase orders"
ON public.purchase_orders FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 8. FIX PURCHASE_ORDER_ITEMS TABLE
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Authenticated users can insert PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Authenticated users can update PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Authenticated users can delete PO items" ON public.purchase_order_items;

-- Owners and employees can view PO items
CREATE POLICY "Owners and employees can view PO items"
ON public.purchase_order_items FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can insert PO items
CREATE POLICY "Owners and employees can insert PO items"
ON public.purchase_order_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can update PO items
CREATE POLICY "Owners and employees can update PO items"
ON public.purchase_order_items FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete PO items
CREATE POLICY "Only owners can delete PO items"
ON public.purchase_order_items FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 9. FIX COMPANIES TABLE
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.companies;

-- Owners and employees can view companies
CREATE POLICY "Owners and employees can view companies"
ON public.companies FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can insert companies
CREATE POLICY "Owners and employees can insert companies"
ON public.companies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can update companies
CREATE POLICY "Owners and employees can update companies"
ON public.companies FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete companies
CREATE POLICY "Only owners can delete companies"
ON public.companies FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 10. FIX BRANCHES TABLE
-- ===========================================
DROP POLICY IF EXISTS "Authenticated users can view all branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can update branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can delete branches" ON public.branches;

-- Owners and employees can view branches
CREATE POLICY "Owners and employees can view branches"
ON public.branches FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can insert branches
CREATE POLICY "Owners and employees can insert branches"
ON public.branches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Owners and employees can update branches
CREATE POLICY "Owners and employees can update branches"
ON public.branches FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

-- Only owners can delete branches
CREATE POLICY "Only owners can delete branches"
ON public.branches FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- ===========================================
-- 11. ENHANCE QUOTES RLS (add owner/employee access)
-- ===========================================
-- Add policies for owners and employees to view/manage all quotes
CREATE POLICY "Owners and employees can view all quotes"
ON public.quotes FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Owners and employees can insert quotes"
ON public.quotes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Owners and employees can update quotes"
ON public.quotes FOR UPDATE
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Only owners can delete any quote"
ON public.quotes FOR DELETE
USING (has_role(auth.uid(), 'owner'));