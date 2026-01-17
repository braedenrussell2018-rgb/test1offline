-- Drop the SECURITY DEFINER view
DROP VIEW IF EXISTS public.signup_notifications_decrypted;

-- Recreate as a regular view (SECURITY INVOKER is default)
CREATE VIEW public.signup_notifications_decrypted AS
SELECT 
  id,
  user_id,
  decrypt_email(email_encrypted) as email,
  full_name,
  signed_up_at,
  read_at,
  created_at
FROM public.signup_notifications;

-- The view inherits RLS from the underlying table (signup_notifications)
-- which already restricts access to owners and developers only

-- Grant access to the view for authenticated users
GRANT SELECT ON public.signup_notifications_decrypted TO authenticated;

-- Add comment
COMMENT ON VIEW public.signup_notifications_decrypted IS 'Decrypted view of signup notifications. Access controlled by RLS on signup_notifications table.';