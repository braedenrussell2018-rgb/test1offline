
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('employee', 'owner', 'customer', 'salesman');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Create spiff_program table for tracking salesman sales and credits
CREATE TABLE public.spiff_program (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    salesman_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    sale_description text NOT NULL,
    sale_amount numeric NOT NULL DEFAULT 0,
    credits_earned integer NOT NULL DEFAULT 0,
    prize_redeemed text,
    redeemed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on spiff_program
ALTER TABLE public.spiff_program ENABLE ROW LEVEL SECURITY;

-- Salesmen can view their own spiff records
CREATE POLICY "Salesmen can view their own spiff records"
ON public.spiff_program
FOR SELECT
TO authenticated
USING (
  auth.uid() = salesman_id 
  AND public.has_role(auth.uid(), 'salesman')
);

-- Salesmen can insert their own spiff records
CREATE POLICY "Salesmen can insert their own spiff records"
ON public.spiff_program
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = salesman_id 
  AND public.has_role(auth.uid(), 'salesman')
);

-- Salesmen can update their own spiff records
CREATE POLICY "Salesmen can update their own spiff records"
ON public.spiff_program
FOR UPDATE
TO authenticated
USING (
  auth.uid() = salesman_id 
  AND public.has_role(auth.uid(), 'salesman')
);

-- Owners and employees can view all spiff records
CREATE POLICY "Owners can view all spiff records"
ON public.spiff_program
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') 
  OR public.has_role(auth.uid(), 'employee')
);

-- Owners can manage all spiff records
CREATE POLICY "Owners can manage all spiff records"
ON public.spiff_program
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Create prizes table for available prizes
CREATE TABLE public.spiff_prizes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    credits_required integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on spiff_prizes
ALTER TABLE public.spiff_prizes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active prizes
CREATE POLICY "Authenticated users can view prizes"
ON public.spiff_prizes
FOR SELECT
TO authenticated
USING (is_active = true);

-- Owners can manage prizes
CREATE POLICY "Owners can manage prizes"
ON public.spiff_prizes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Add trigger for updated_at on spiff_program
CREATE TRIGGER update_spiff_program_updated_at
BEFORE UPDATE ON public.spiff_program
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
