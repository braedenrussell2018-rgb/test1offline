import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { useSecuritySettings } from "./useSecuritySettings";
import { logAuditEvent, AuditEvents } from "./useAuditLog";
import { useToast } from "./use-toast";

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];
const ACTIVITY_THROTTLE_MS = 60000; // Update activity at most once per minute

export function useSessionManager() {
  const { user, signOut } = useAuth();
  const { settings, updateActivity, checkSessionTimeout } = useSecuritySettings();
  const { toast } = useToast();
  const lastActivityUpdate = useRef<number>(0);
  const timeoutCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const warningShown = useRef(false);

  // Handle user activity
  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityUpdate.current >= ACTIVITY_THROTTLE_MS) {
      lastActivityUpdate.current = now;
      updateActivity();
      warningShown.current = false;
    }
  }, [updateActivity]);

  // Check for session timeout
  const checkTimeout = useCallback(async () => {
    if (!user || !settings) return;

    const isTimedOut = checkSessionTimeout();
    
    if (isTimedOut) {
      // Log the timeout
      await logAuditEvent(AuditEvents.SESSION_EXPIRED());
      
      toast({
        title: "Session Expired",
        description: "Your session has expired due to inactivity. Please sign in again.",
        variant: "destructive",
      });
      
      await signOut();
    } else if (settings.session_timeout_minutes) {
      // Check if we should show a warning (5 minutes before timeout)
      const lastActivity = settings.last_activity ? new Date(settings.last_activity) : new Date();
      const timeoutMs = settings.session_timeout_minutes * 60 * 1000;
      const warningMs = 5 * 60 * 1000; // 5 minutes
      const elapsed = Date.now() - lastActivity.getTime();
      
      if (!warningShown.current && elapsed > (timeoutMs - warningMs)) {
        warningShown.current = true;
        toast({
          title: "Session Expiring Soon",
          description: "Your session will expire in 5 minutes due to inactivity. Move your mouse or press a key to stay signed in.",
        });
      }
    }
  }, [user, settings, checkSessionTimeout, signOut, toast]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up timeout check interval (check every minute)
    timeoutCheckInterval.current = setInterval(checkTimeout, 60000);

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (timeoutCheckInterval.current) {
        clearInterval(timeoutCheckInterval.current);
      }
    };
  }, [user, handleActivity, checkTimeout]);

  // Handle visibility change (tab focus)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimeout();
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, checkTimeout, handleActivity]);

  return {
    sessionTimeoutMinutes: settings?.session_timeout_minutes || 30,
    lastActivity: settings?.last_activity,
  };
}
