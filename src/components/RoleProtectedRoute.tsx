import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
}

export const RoleProtectedRoute = ({ 
  children, 
  allowedRoles, 
  redirectTo = "/" 
}: RoleProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    // If user is authenticated but has no role, redirect to select-role
    if (!authLoading && !roleLoading && user && role === null) {
      navigate("/select-role");
      return;
    }

    if (!authLoading && !roleLoading && user && role) {
      if (!allowedRoles.includes(role)) {
        // Redirect based on user's actual role
        if (role === "salesman") {
          navigate("/spiff-program");
        } else if (role === "customer") {
          navigate("/customer");
        } else {
          navigate(redirectTo);
        }
      }
    }
  }, [user, authLoading, role, roleLoading, allowedRoles, navigate, redirectTo]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
};
