import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "employee" | "owner" | "customer" | "salesman" | null;

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
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

  const hasRole = (checkRole: AppRole): boolean => {
    return role === checkRole;
  };

  const isSalesman = (): boolean => role === "salesman";
  const isOwner = (): boolean => role === "owner";
  const isEmployee = (): boolean => role === "employee";
  const isCustomer = (): boolean => role === "customer";

  // Check if user has internal access (owner or employee)
  const hasInternalAccess = (): boolean => {
    return role === "owner" || role === "employee";
  };

  return {
    role,
    loading: loading || authLoading,
    hasRole,
    isSalesman,
    isOwner,
    isEmployee,
    isCustomer,
    hasInternalAccess,
  };
};
