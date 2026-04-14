-- Remove the overly permissive policy that allows anyone to view receipts
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;