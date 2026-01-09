-- Remove SELECT policy that exposes tokens to client code
-- The Edge Functions use service role which bypasses RLS anyway
DROP POLICY IF EXISTS "Users can view their own QB connection" ON quickbooks_connections;

-- Create a restricted SELECT policy that only returns non-sensitive fields
-- This uses a function to mask sensitive data
CREATE OR REPLACE FUNCTION public.get_qb_connection_status(p_user_id uuid)
RETURNS TABLE (
  connected_at timestamp with time zone,
  realm_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT connected_at, realm_id
  FROM public.quickbooks_connections
  WHERE user_id = p_user_id
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_qb_connection_status(uuid) TO authenticated;

-- Revoke direct SELECT access - only service role can read tokens
-- Edge functions already use service role key, so this won't break them
REVOKE SELECT ON public.quickbooks_connections FROM authenticated;
REVOKE SELECT ON public.quickbooks_connections FROM anon;