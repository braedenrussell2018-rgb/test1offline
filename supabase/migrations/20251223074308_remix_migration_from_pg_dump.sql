CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
);


--
-- Name: add_note_to_contact(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_note_to_contact(p_person_id uuid, p_note_text text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_notes jsonb;
  v_new_note jsonb;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the new note object
  v_new_note := jsonb_build_object(
    'text', p_note_text,
    'timestamp', now()::text
  );

  -- Get current notes
  SELECT COALESCE(notes, '[]'::jsonb) INTO v_current_notes
  FROM public.people
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- Append new note to existing notes array
  UPDATE public.people
  SET notes = v_current_notes || v_new_note,
      updated_at = now()
  WHERE id = p_person_id;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: account_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    transaction_date date NOT NULL,
    amount numeric NOT NULL,
    description text,
    reference_type text,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    account_type public.account_type NOT NULL,
    parent_account_id uuid,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month date NOT NULL,
    account_id uuid NOT NULL,
    forecasted_amount numeric NOT NULL,
    actual_amount numeric DEFAULT 0,
    notes text,
    generated_by_ai boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    address text,
    notes jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_name text NOT NULL,
    customer_id uuid,
    amount numeric NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    category text NOT NULL,
    description text,
    receipt_url text,
    credit_card_last4 text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    invoice_number text NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    customer_address text,
    ship_to_name text,
    ship_to_address text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    shipping numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    salesman_name text,
    paid boolean DEFAULT false,
    paid_at timestamp with time zone
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    part_number text NOT NULL,
    description text NOT NULL,
    status text NOT NULL,
    sale_price numeric(10,2),
    cost numeric(10,2),
    weight numeric(10,2),
    volume numeric(10,2),
    warranty_months integer,
    serial_number text,
    min_reorder_level integer,
    max_reorder_level integer,
    sold_in_invoice_id uuid,
    date_sold timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shelf_location text,
    CONSTRAINT items_status_check CHECK ((status = ANY (ARRAY['available'::text, 'sold'::text])))
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    company_id uuid,
    job_title text,
    email text,
    phone text,
    address text,
    notes jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    excavator_lines text[] DEFAULT '{}'::text[],
    branch_id uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    part_number text NOT NULL,
    serial_number text,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_cost numeric NOT NULL,
    total_cost numeric NOT NULL,
    received_quantity integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text NOT NULL,
    vendor_id uuid,
    vendor_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric NOT NULL,
    shipping numeric DEFAULT 0,
    tax numeric DEFAULT 0,
    total numeric NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    quote_number text NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    customer_address text,
    ship_to_name text,
    ship_to_address text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    shipping numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    salesman_name text
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address text,
    notes jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: account_transactions account_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_account_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_number_key UNIQUE (account_number);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: budget_forecasts budget_forecasts_month_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts
    ADD CONSTRAINT budget_forecasts_month_account_id_key UNIQUE (month, account_id);


--
-- Name: budget_forecasts budget_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts
    ADD CONSTRAINT budget_forecasts_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: quotes estimates_estimate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT estimates_estimate_number_key UNIQUE (quote_number);


--
-- Name: quotes estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_account_transactions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_transactions_account_id ON public.account_transactions USING btree (account_id);


--
-- Name: idx_account_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_transactions_date ON public.account_transactions USING btree (transaction_date);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type ON public.accounts USING btree (account_type);


--
-- Name: idx_budget_forecasts_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_forecasts_month ON public.budget_forecasts USING btree (month);


--
-- Name: idx_estimates_estimate_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_estimate_number ON public.quotes USING btree (quote_number);


--
-- Name: idx_invoices_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_items_part_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_part_number ON public.items USING btree (part_number);


--
-- Name: idx_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_status ON public.items USING btree (status);


--
-- Name: idx_people_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_company_id ON public.people USING btree (company_id);


--
-- Name: idx_people_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_user_id ON public.people USING btree (user_id);


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: branches update_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: budget_forecasts update_budget_forecasts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_budget_forecasts_updated_at BEFORE UPDATE ON public.budget_forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expenses update_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: items update_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: people update_people_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_transactions account_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: branches branches_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: budget_forecasts budget_forecasts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts
    ADD CONSTRAINT budget_forecasts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: people people_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: people people_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: people people_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items Authenticated users can delete PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete PO items" ON public.purchase_order_items FOR DELETE USING (true);


--
-- Name: accounts Authenticated users can delete accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (true);


--
-- Name: branches Authenticated users can delete branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete branches" ON public.branches FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: companies Authenticated users can delete companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete companies" ON public.companies FOR DELETE TO authenticated USING (true);


--
-- Name: quotes Authenticated users can delete estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete estimates" ON public.quotes FOR DELETE TO authenticated USING (true);


--
-- Name: expenses Authenticated users can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete expenses" ON public.expenses FOR DELETE USING (true);


--
-- Name: budget_forecasts Authenticated users can delete forecasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete forecasts" ON public.budget_forecasts FOR DELETE TO authenticated USING (true);


--
-- Name: invoices Authenticated users can delete invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (true);


--
-- Name: items Authenticated users can delete items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete items" ON public.items FOR DELETE TO authenticated USING (true);


--
-- Name: purchase_orders Authenticated users can delete purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete purchase orders" ON public.purchase_orders FOR DELETE USING (true);


--
-- Name: account_transactions Authenticated users can delete transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete transactions" ON public.account_transactions FOR DELETE TO authenticated USING (true);


--
-- Name: vendors Authenticated users can delete vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete vendors" ON public.vendors FOR DELETE USING (true);


--
-- Name: purchase_order_items Authenticated users can insert PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert PO items" ON public.purchase_order_items FOR INSERT WITH CHECK (true);


--
-- Name: accounts Authenticated users can insert accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: branches Authenticated users can insert branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert branches" ON public.branches FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: companies Authenticated users can insert companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: quotes Authenticated users can insert estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert estimates" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: expenses Authenticated users can insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT WITH CHECK (true);


--
-- Name: budget_forecasts Authenticated users can insert forecasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert forecasts" ON public.budget_forecasts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: invoices Authenticated users can insert invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: items Authenticated users can insert items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert items" ON public.items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: purchase_orders Authenticated users can insert purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (true);


--
-- Name: account_transactions Authenticated users can insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert transactions" ON public.account_transactions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: vendors Authenticated users can insert vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert vendors" ON public.vendors FOR INSERT WITH CHECK (true);


--
-- Name: purchase_order_items Authenticated users can update PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update PO items" ON public.purchase_order_items FOR UPDATE USING (true);


--
-- Name: accounts Authenticated users can update accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (true);


--
-- Name: branches Authenticated users can update branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update branches" ON public.branches FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: companies Authenticated users can update companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update companies" ON public.companies FOR UPDATE TO authenticated USING (true);


--
-- Name: people Authenticated users can update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update contacts" ON public.people FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: quotes Authenticated users can update estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update estimates" ON public.quotes FOR UPDATE TO authenticated USING (true);


--
-- Name: expenses Authenticated users can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update expenses" ON public.expenses FOR UPDATE USING (true);


--
-- Name: budget_forecasts Authenticated users can update forecasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update forecasts" ON public.budget_forecasts FOR UPDATE TO authenticated USING (true);


--
-- Name: invoices Authenticated users can update invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);


--
-- Name: items Authenticated users can update items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update items" ON public.items FOR UPDATE TO authenticated USING (true);


--
-- Name: purchase_orders Authenticated users can update purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update purchase orders" ON public.purchase_orders FOR UPDATE USING (true);


--
-- Name: account_transactions Authenticated users can update transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update transactions" ON public.account_transactions FOR UPDATE TO authenticated USING (true);


--
-- Name: vendors Authenticated users can update vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update vendors" ON public.vendors FOR UPDATE USING (true);


--
-- Name: purchase_order_items Authenticated users can view all PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all PO items" ON public.purchase_order_items FOR SELECT USING (true);


--
-- Name: accounts Authenticated users can view all accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all accounts" ON public.accounts FOR SELECT TO authenticated USING (true);


--
-- Name: branches Authenticated users can view all branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all branches" ON public.branches FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: companies Authenticated users can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all companies" ON public.companies FOR SELECT TO authenticated USING (true);


--
-- Name: people Authenticated users can view all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all contacts" ON public.people FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: quotes Authenticated users can view all estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all estimates" ON public.quotes FOR SELECT TO authenticated USING (true);


--
-- Name: expenses Authenticated users can view all expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all expenses" ON public.expenses FOR SELECT USING (true);


--
-- Name: budget_forecasts Authenticated users can view all forecasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all forecasts" ON public.budget_forecasts FOR SELECT TO authenticated USING (true);


--
-- Name: invoices Authenticated users can view all invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all invoices" ON public.invoices FOR SELECT TO authenticated USING (true);


--
-- Name: items Authenticated users can view all items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all items" ON public.items FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Authenticated users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: purchase_orders Authenticated users can view all purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all purchase orders" ON public.purchase_orders FOR SELECT USING (true);


--
-- Name: account_transactions Authenticated users can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all transactions" ON public.account_transactions FOR SELECT TO authenticated USING (true);


--
-- Name: vendors Authenticated users can view all vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all vendors" ON public.vendors FOR SELECT USING (true);


--
-- Name: people Users can create their own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own contacts" ON public.people FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: people Users can delete their own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own contacts" ON public.people FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: account_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budget_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

--
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;