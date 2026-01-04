import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

/**
 * Hook to verify that authenticated users have a role assigned.
 * Redirects to /select-role if user is authenticated but has no role.
 */
export const useRoleVerification = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Don't run verification while still loading
    if (authLoading || roleLoading) {
      return;
    }

    // If no user, they should be on auth page (handled by other guards)
    if (!user) {
      setIsVerified(true);
      return;
    }

    // If user is on select-role page, let them stay there
    if (location.pathname === "/select-role") {
      setIsVerified(true);
      return;
    }

    // If user is on auth page, let them stay there
    if (location.pathname === "/auth") {
      setIsVerified(true);
      return;
    }

    // If user exists but has no role, redirect to select-role
    if (user && role === null) {
      navigate("/select-role", { replace: true });
      return;
    }

    // User has a role, they're verified
    setIsVerified(true);
  }, [user, role, authLoading, roleLoading, navigate, location.pathname]);

  return {
    isVerified,
    loading: authLoading || roleLoading,
  };
};
