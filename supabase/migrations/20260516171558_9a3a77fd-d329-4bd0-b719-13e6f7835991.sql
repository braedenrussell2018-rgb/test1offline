-- Shared server-side geocode cache
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  address_key text PRIMARY KEY,
  display_address text,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  source text NOT NULL DEFAULT 'nominatim',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view geocode cache"
ON public.geocode_cache FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'salesman'::app_role));

CREATE POLICY "Internal users can insert geocode cache"
ON public.geocode_cache FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'salesman'::app_role));

CREATE POLICY "Internal users can update geocode cache"
ON public.geocode_cache FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'salesman'::app_role));

CREATE POLICY "Owners and developers can delete geocode cache"
ON public.geocode_cache FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE TRIGGER trg_geocode_cache_updated_at
BEFORE UPDATE ON public.geocode_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;