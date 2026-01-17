-- Security Migration: Fix all error-level security issues
-- 1. Drop plaintext token columns from quickbooks_connections (no data exists)
-- 2. Fix receipt storage policies to restrict by user
-- 3. Fix QuickBooks connection RLS to allow view access
-- 4. Update vendors RLS to include developer role

-- =============================================================
-- 1. Drop plaintext token columns from quickbooks_connections
-- Since no data exists and new tokens are encrypted, safe to drop
-- =============================================================
ALTER TABLE public.quickbooks_connections 
DROP COLUMN IF EXISTS access_token;

ALTER TABLE public.quickbooks_connections 
DROP COLUMN IF EXISTS refresh_token;

-- Make encrypted columns NOT NULL now that plaintext is gone
ALTER TABLE public.quickbooks_connections 
ALTER COLUMN access_token_encrypted SET NOT NULL;

ALTER TABLE public.quickbooks_connections 
ALTER COLUMN refresh_token_encrypted SET NOT NULL;

-- =============================================================
-- 2. Fix receipt storage policies - restrict to user's own files
-- =============================================================
DROP POLICY IF EXISTS "Receipt upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Receipt view policy" ON storage.objects;
DROP POLICY IF EXISTS "Receipt delete policy" ON storage.objects;

-- Only allow users to upload receipts to their own folder
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Only allow users to view their own receipts
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Only allow users to delete their own receipts
CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow owners and developers to view all receipts for auditing
CREATE POLICY "Owners and developers can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'developer')
    )
  )
);

-- =============================================================
-- 3. Fix QuickBooks connection RLS policies for view access
-- Drop the overly restrictive policy and create proper user-scoped policies
-- =============================================================
DROP POLICY IF EXISTS "Users can view their own QB status" ON public.quickbooks_connections;

-- Allow users to view their own connection status (for the view)
CREATE POLICY "Users can view their own QB connection"
ON public.quickbooks_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow owners and developers to view all QB connections for admin
CREATE POLICY "Owners and developers can view all QB connections"
ON public.quickbooks_connections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'developer')
  )
);

-- =============================================================
-- 4. Update vendors RLS policies to include developer role
-- =============================================================
DROP POLICY IF EXISTS "Owners and employees can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Owners and employees can insert vendors" ON public.vendors;
DROP POLICY IF EXISTS "Owners and employees can update vendors" ON public.vendors;
DROP POLICY IF EXISTS "Only owners can delete vendors" ON public.vendors;

-- View policy with developer role
CREATE POLICY "Internal users can view vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR
  has_role(auth.uid(), 'developer'::app_role)
);

-- Insert policy with developer role
CREATE POLICY "Internal users can insert vendors"
ON public.vendors
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR
  has_role(auth.uid(), 'developer'::app_role)
);

-- Update policy with developer role
CREATE POLICY "Internal users can update vendors"
ON public.vendors
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR
  has_role(auth.uid(), 'developer'::app_role)
);

-- Delete policy - owners and developers only
CREATE POLICY "Owners and developers can delete vendors"
ON public.vendors
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'developer'::app_role)
);