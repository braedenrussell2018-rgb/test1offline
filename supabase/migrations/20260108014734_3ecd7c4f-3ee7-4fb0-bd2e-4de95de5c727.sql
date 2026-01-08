-- Create QuickBooks connections table
CREATE TABLE public.quickbooks_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  realm_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create QuickBooks sync log table
CREATE TABLE public.quickbooks_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  quickbooks_id TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'to_quickbooks',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for quickbooks_connections
CREATE POLICY "Users can view their own QB connection"
  ON public.quickbooks_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own QB connection"
  ON public.quickbooks_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own QB connection"
  ON public.quickbooks_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own QB connection"
  ON public.quickbooks_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for quickbooks_sync_log
CREATE POLICY "Users can view their own QB sync logs"
  ON public.quickbooks_sync_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own QB sync logs"
  ON public.quickbooks_sync_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_quickbooks_connections_updated_at
  BEFORE UPDATE ON public.quickbooks_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();