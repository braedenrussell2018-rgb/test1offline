import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "employee" | "owner" | "customer" | "salesman" | null;

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
        setRole(data?.role as AppRole || null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

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
    loading,
    hasRole,
    isSalesman,
    isOwner,
    isEmployee,
    isCustomer,
    hasInternalAccess,
  };
};
