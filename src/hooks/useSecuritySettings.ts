import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SecuritySettings {
  mfa_enabled: boolean;
  mfa_verified_at: string | null;
  failed_login_attempts: number;
  account_locked: boolean;
  account_locked_at: string | null;
  account_locked_reason: string | null;
  password_changed_at: string | null;
  session_timeout_minutes: number;
  require_password_change: boolean;
  last_activity: string | null;
}

interface RateLimitStatus {
  allowed: boolean;
  failed_attempts: number;
  max_attempts: number;
  remaining: number;
  account_locked: boolean;
  lockout_minutes_remaining: number;
}

export function useSecuritySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_security_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching security settings:", error);
      }

      setSettings(data as SecuritySettings | null);
    } catch (err) {
      console.error("Failed to fetch security settings:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update session activity
  const updateActivity = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from("user_security_settings")
        .update({ last_activity: new Date().toISOString() })
        .eq("user_id", user.id);
    } catch (err) {
      console.error("Failed to update activity:", err);
    }
  }, [user]);

  // Check session timeout
  const checkSessionTimeout = useCallback((): boolean => {
    if (!settings?.last_activity || !settings?.session_timeout_minutes) {
      return false;
    }

    const lastActivity = new Date(settings.last_activity);
    const timeoutMs = settings.session_timeout_minutes * 60 * 1000;
    const now = new Date();

    return (now.getTime() - lastActivity.getTime()) > timeoutMs;
  }, [settings]);

  return {
    settings,
    loading,
    refetch: fetchSettings,
    updateActivity,
    checkSessionTimeout,
    isAccountLocked: settings?.account_locked || false,
    isMfaEnabled: settings?.mfa_enabled || false,
    requiresPasswordChange: settings?.require_password_change || false,
  };
}

// Check rate limit before login (can be used without auth)
export async function checkRateLimit(email: string): Promise<RateLimitStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('security-check', {
      body: {
        action: 'check_rate_limit',
        email,
      },
    });

    if (error) {
      console.error("Rate limit check failed:", error);
      return {
        allowed: true, // Fail open
        failed_attempts: 0,
        max_attempts: 5,
        remaining: 5,
        account_locked: false,
        lockout_minutes_remaining: 0,
      };
    }

    return data;
  } catch (err) {
    console.error("Rate limit check error:", err);
    return {
      allowed: true,
      failed_attempts: 0,
      max_attempts: 5,
      remaining: 5,
      account_locked: false,
      lockout_minutes_remaining: 0,
    };
  }
}

// Record login attempt
export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  try {
    await supabase.functions.invoke('security-check', {
      body: {
        action: 'record_attempt',
        email,
        success,
      },
    });
  } catch (err) {
    console.error("Failed to record login attempt:", err);
  }
}

// Unlock user account (admin only)
export async function unlockAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('security-check', {
      body: {
        action: 'unlock_account',
        user_id: userId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to unlock account' };
  }
}

// Lock user account (admin only)
export async function lockAccount(userId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('security-check', {
      body: {
        action: 'lock_account',
        user_id: userId,
        reason,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to lock account' };
  }
}
