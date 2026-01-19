import { useMemo } from "react";
import { useAuth, AppRole } from "./useAuth";

// Re-export AppRole for backwards compatibility
export type { AppRole };

/**
 * Hook for accessing user role information.
 * Role is now managed centrally in AuthContext to prevent race conditions
 * and redundant fetches.
 */
export const useUserRole = () => {
  const { role, roleLoading, loading: authLoading, refetchRole } = useAuth();

  // Memoize helper functions to ensure they use the current role value
  const helpers = useMemo(() => ({
    hasRole: (checkRole: AppRole): boolean => role === checkRole,
    isSalesman: (): boolean => role === "salesman",
    isOwner: (): boolean => role === "owner",
    isEmployee: (): boolean => role === "employee",
    isCustomer: (): boolean => role === "customer",
    isDeveloper: (): boolean => role === "developer",
    // Check if user has internal access (owner, employee, or developer)
    hasInternalAccess: (): boolean => role === "owner" || role === "employee" || role === "developer",
    // Developer has owner privileges
    hasOwnerAccess: (): boolean => role === "owner" || role === "developer",
  }), [role]);

  return {
    role,
    loading: roleLoading || authLoading,
    refetchRole,
    ...helpers,
  };
};
