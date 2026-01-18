import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "employee" | "owner" | "customer" | "salesman" | "developer" | null;

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      console.log("Fetching role for user:", userId);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
        console.log("Role fetched:", data?.role);
        setRole((data?.role as AppRole) || null);
      }
    } catch (err) {
      console.error("Failed to fetch role:", err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Fetch role when user is available
    setLoading(true);
    fetchRole(user.id);
  }, [user, authLoading, fetchRole]);

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
    loading: loading || authLoading,
    ...helpers,
  };
};
