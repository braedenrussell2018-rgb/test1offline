-- Remove client access to QuickBooks tokens for security
-- Tokens should ONLY be accessed server-side via edge functions with service role

-- Drop existing policies that might expose tokens
DROP POLICY IF EXISTS "Users can view their own QB connection" ON public.quickbooks_connections;
DROP POLICY IF EXISTS "Users can insert their own QB connection" ON public.quickbooks_connections;
DROP POLICY IF EXISTS "Users can update their own QB connection" ON public.quickbooks_connections;
DROP POLICY IF EXISTS "Users can delete their own QB connection" ON public.quickbooks_connections;

-- Create a secure view for client-side status checks (no tokens exposed)
CREATE OR REPLACE VIEW public.quickbooks_connection_status AS
SELECT 
  user_id,
  realm_id,
  connected_at,
  CASE WHEN token_expires_at > now() THEN true ELSE false END as is_token_valid
FROM public.quickbooks_connections;

-- Enable RLS on the view
ALTER VIEW public.quickbooks_connection_status SET (security_invoker = true);

-- Grant access to the view for authenticated users to check their own status
CREATE POLICY "Users can view their own QB status"
ON public.quickbooks_connections
FOR SELECT
USING (false);  -- Block all direct client access to the table

-- All QuickBooks operations must go through edge functions with service role key
-- This ensures tokens are NEVER exposed to client queries

COMMENT ON TABLE public.quickbooks_connections IS 'QuickBooks OAuth tokens - SERVER-SIDE ACCESS ONLY via edge functions. No client access permitted for security.';