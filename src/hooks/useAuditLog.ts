import { supabase } from "@/integrations/supabase/client";

type ActionCategory = 'auth' | 'data_access' | 'data_modification' | 'admin' | 'export' | 'security';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type Result = 'success' | 'failure' | 'blocked';

interface AuditLogParams {
  action: string;
  action_category: ActionCategory;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  result?: Result;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
  risk_level?: RiskLevel;
}

// Generate a unique session ID for this browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
};

/**
 * Log an audit event for SOC 2 compliance
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    await supabase.functions.invoke('audit-log', {
      body: params,
      headers: {
        'x-session-id': getSessionId(),
      },
    });
  } catch (error) {
    // Fail silently but log to console in dev
    console.error('Failed to log audit event:', error);
  }
}

// Pre-defined audit events for common actions
export const AuditEvents = {
  // Authentication events
  LOGIN_SUCCESS: (email: string) => ({
    action: 'login_success',
    action_category: 'auth' as ActionCategory,
    target_type: 'user',
    target_name: email,
    result: 'success' as Result,
    risk_level: 'low' as RiskLevel,
  }),
  
  LOGIN_FAILED: (email: string, reason: string) => ({
    action: 'login_failed',
    action_category: 'auth' as ActionCategory,
    target_type: 'user',
    target_name: email,
    result: 'failure' as Result,
    failure_reason: reason,
    risk_level: 'medium' as RiskLevel,
  }),
  
  LOGOUT: () => ({
    action: 'logout',
    action_category: 'auth' as ActionCategory,
    result: 'success' as Result,
    risk_level: 'low' as RiskLevel,
  }),
  
  SESSION_EXPIRED: () => ({
    action: 'session_expired',
    action_category: 'auth' as ActionCategory,
    result: 'success' as Result,
    risk_level: 'low' as RiskLevel,
  }),

  // Role changes
  ROLE_CHANGED: (userId: string, oldRole: string, newRole: string) => ({
    action: 'role_changed',
    action_category: 'admin' as ActionCategory,
    target_type: 'user',
    target_id: userId,
    result: 'success' as Result,
    metadata: { old_role: oldRole, new_role: newRole },
    risk_level: 'high' as RiskLevel,
  }),

  // Data access
  DATA_VIEWED: (dataType: string, recordId?: string) => ({
    action: 'data_viewed',
    action_category: 'data_access' as ActionCategory,
    target_type: dataType,
    target_id: recordId,
    result: 'success' as Result,
    risk_level: 'low' as RiskLevel,
  }),

  // Data modification
  RECORD_CREATED: (dataType: string, recordId: string, recordName?: string) => ({
    action: 'record_created',
    action_category: 'data_modification' as ActionCategory,
    target_type: dataType,
    target_id: recordId,
    target_name: recordName,
    result: 'success' as Result,
    risk_level: 'low' as RiskLevel,
  }),

  RECORD_UPDATED: (dataType: string, recordId: string, recordName?: string, changes?: Record<string, unknown>) => ({
    action: 'record_updated',
    action_category: 'data_modification' as ActionCategory,
    target_type: dataType,
    target_id: recordId,
    target_name: recordName,
    result: 'success' as Result,
    metadata: changes ? { changes } : undefined,
    risk_level: 'low' as RiskLevel,
  }),

  RECORD_DELETED: (dataType: string, recordId: string, recordName?: string) => ({
    action: 'record_deleted',
    action_category: 'data_modification' as ActionCategory,
    target_type: dataType,
    target_id: recordId,
    target_name: recordName,
    result: 'success' as Result,
    risk_level: 'medium' as RiskLevel,
  }),

  // Data export
  DATA_EXPORTED: (exportType: string, format: string, recordCount: number) => ({
    action: 'data_exported',
    action_category: 'export' as ActionCategory,
    target_type: exportType,
    result: 'success' as Result,
    metadata: { format, record_count: recordCount },
    risk_level: 'medium' as RiskLevel,
  }),

  // Security events
  ACCESS_DENIED: (resource: string, reason: string) => ({
    action: 'access_denied',
    action_category: 'security' as ActionCategory,
    target_type: resource,
    result: 'blocked' as Result,
    failure_reason: reason,
    risk_level: 'high' as RiskLevel,
  }),

  ACCOUNT_LOCKED: (userId: string, reason: string) => ({
    action: 'account_locked',
    action_category: 'security' as ActionCategory,
    target_type: 'user',
    target_id: userId,
    result: 'success' as Result,
    metadata: { reason },
    risk_level: 'critical' as RiskLevel,
  }),

  ACCOUNT_UNLOCKED: (userId: string) => ({
    action: 'account_unlocked',
    action_category: 'admin' as ActionCategory,
    target_type: 'user',
    target_id: userId,
    result: 'success' as Result,
    risk_level: 'high' as RiskLevel,
  }),

  // Settings changes
  SETTINGS_UPDATED: (settingType: string, changes: Record<string, unknown>) => ({
    action: 'settings_updated',
    action_category: 'admin' as ActionCategory,
    target_type: settingType,
    result: 'success' as Result,
    metadata: { changes },
    risk_level: 'medium' as RiskLevel,
  }),
};

export function useAuditLog() {
  return {
    log: logAuditEvent,
    events: AuditEvents,
  };
}
