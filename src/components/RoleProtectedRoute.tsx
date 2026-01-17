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

    if (!authLoading && !roleLoading && user && role) {
      // Developer has owner privileges - check if we should treat as owner
      const effectiveRoles = [...allowedRoles];
      if (allowedRoles.includes("owner") && !allowedRoles.includes("developer")) {
        effectiveRoles.push("developer");
      }
      
      if (!effectiveRoles.includes(role)) {
        // Redirect based on user's actual role
        if (role === "salesman") {
          navigate("/spiff-program");
        } else if (role === "customer") {
          navigate("/customer");
        } else if (role === "developer") {
          navigate("/developer");
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

  // Wait for role to be determined before showing content
  if (role === null) {
    return null;
  }

  // Developer has owner privileges
  const effectiveRoles = [...allowedRoles];
  if (allowedRoles.includes("owner") && !allowedRoles.includes("developer")) {
    effectiveRoles.push("developer");
  }
  
  if (!effectiveRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
};
