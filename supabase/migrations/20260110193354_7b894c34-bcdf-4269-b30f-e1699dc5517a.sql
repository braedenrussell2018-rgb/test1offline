-- =====================================================
-- SOC 2 TYPE I COMPLIANCE: ENHANCED AUDIT LOGGING
-- =====================================================

-- Drop existing audit_logs table if it exists and recreate with SOC 2 fields
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Create comprehensive audit_logs table with all SOC 2 required fields
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamp with time zone NOT NULL DEFAULT now(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email text,
    actor_role text,
    action text NOT NULL,
    action_category text NOT NULL, -- 'auth', 'data_access', 'data_modification', 'admin', 'export', 'security'
    target_type text, -- 'user', 'role', 'invoice', 'expense', 'item', etc.
    target_id text,
    target_name text,
    result text NOT NULL DEFAULT 'success', -- 'success', 'failure', 'blocked'
    failure_reason text,
    ip_address inet,
    user_agent text,
    request_id uuid DEFAULT gen_random_uuid(),
    session_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    risk_level text DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON public.audit_logs(action_category);
CREATE INDEX idx_audit_logs_result ON public.audit_logs(result);
CREATE INDEX idx_audit_logs_risk_level ON public.audit_logs(risk_level);
CREATE INDEX idx_audit_logs_target ON public.audit_logs(target_type, target_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs (compliance requirement)
CREATE POLICY "Only owners can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- No direct inserts from clients - only through edge functions with service role
-- This prevents log tampering

-- Create user_security_settings table for MFA and session settings
CREATE TABLE public.user_security_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    mfa_enabled boolean DEFAULT false,
    mfa_verified_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    last_failed_login timestamp with time zone,
    account_locked boolean DEFAULT false,
    account_locked_at timestamp with time zone,
    account_locked_reason text,
    password_changed_at timestamp with time zone DEFAULT now(),
    session_timeout_minutes integer DEFAULT 30,
    require_password_change boolean DEFAULT false,
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security settings
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own security settings
CREATE POLICY "Users can view own security settings"
ON public.user_security_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own security settings (limited fields)
CREATE POLICY "Users can update own security settings"
ON public.user_security_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Owners can view all security settings
CREATE POLICY "Owners can view all security settings"
ON public.user_security_settings
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- Owners can update all security settings
CREATE POLICY "Owners can update all security settings"
ON public.user_security_settings
FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role));

-- Create login_attempts table for rate limiting
CREATE TABLE public.login_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    ip_address inet,
    success boolean DEFAULT false,
    attempted_at timestamp with time zone NOT NULL DEFAULT now(),
    user_agent text
);

-- Create index for rate limiting queries
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at DESC);

-- Enable RLS - only edge functions can insert, owners can view
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owners can view login attempts"
ON public.login_attempts
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- Create data_export_logs for tracking data exports (SOC 2 requirement)
CREATE TABLE public.data_export_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    export_type text NOT NULL, -- 'audit_logs', 'invoices', 'customers', 'full_backup'
    export_format text NOT NULL, -- 'csv', 'json', 'pdf'
    record_count integer DEFAULT 0,
    filters_applied jsonb DEFAULT '{}'::jsonb,
    exported_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address inet,
    download_completed boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.data_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owners can view export logs"
ON public.data_export_logs
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- Create trigger to auto-create security settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_security_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created_security ON auth.users;
CREATE TRIGGER on_auth_user_created_security
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_security();

-- Function to check if account is locked or rate limited
CREATE OR REPLACE FUNCTION public.check_account_status(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_failed_count integer;
    v_is_locked boolean;
BEGIN
    -- Check failed login attempts in last 15 minutes
    SELECT COUNT(*) INTO v_failed_count
    FROM public.login_attempts
    WHERE email = lower(p_email)
    AND attempted_at > now() - interval '15 minutes'
    AND success = false;

    -- Check if account is locked
    SELECT account_locked INTO v_is_locked
    FROM public.user_security_settings uss
    JOIN auth.users au ON au.id = uss.user_id
    WHERE au.email = lower(p_email);

    v_result := jsonb_build_object(
        'failed_attempts', COALESCE(v_failed_count, 0),
        'is_locked', COALESCE(v_is_locked, false),
        'attempts_remaining', GREATEST(0, 5 - COALESCE(v_failed_count, 0)),
        'lockout_threshold', 5
    );

    RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_account_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_status(text) TO anon;