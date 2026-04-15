-- Fix the receipts bucket UPDATE policy to include ownership check
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;

CREATE POLICY "Users can update their own receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Add user_id and job_title tracking to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS job_title text;

-- Backfill: we can't retroactively set these, but new entries will have them