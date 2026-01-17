-- Fix the quickbooks_connection_status view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.quickbooks_connection_status;

CREATE VIEW public.quickbooks_connection_status 
WITH (security_invoker = true)
AS
SELECT 
    user_id,
    realm_id,
    connected_at,
    CASE
        WHEN (token_expires_at > now()) THEN true
        ELSE false
    END AS is_token_valid
FROM quickbooks_connections;

-- Ensure RLS is enabled on the underlying table
ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT SELECT ON public.quickbooks_connection_status TO authenticated;

-- Also ensure the signup_notifications_decrypted view has security_invoker
DROP VIEW IF EXISTS public.signup_notifications_decrypted;

CREATE VIEW public.signup_notifications_decrypted 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  decrypt_email(email_encrypted) as email,
  full_name,
  signed_up_at,
  read_at,
  created_at
FROM public.signup_notifications;

GRANT SELECT ON public.signup_notifications_decrypted TO authenticated;