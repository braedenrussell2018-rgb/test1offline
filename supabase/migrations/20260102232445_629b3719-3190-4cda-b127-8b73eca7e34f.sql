-- Make audio-recordings bucket private and update RLS policies

-- Update bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'audio-recordings';

-- Drop the public access policy that allows unauthenticated access
DROP POLICY IF EXISTS "Public can view audio recordings" ON storage.objects;

-- Keep existing user-scoped policies for authenticated access (if they exist, recreate them)
DROP POLICY IF EXISTS "Users can upload their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio" ON storage.objects;

-- Create proper RLS policies for authenticated user access only
CREATE POLICY "Users can upload their own audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);