-- Fix the view to use security invoker instead of security definer
DROP VIEW IF EXISTS public.active_people;
CREATE VIEW public.active_people 
WITH (security_invoker = true)
AS SELECT * FROM public.people WHERE deleted_at IS NULL;