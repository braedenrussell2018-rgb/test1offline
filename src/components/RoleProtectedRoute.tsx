import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";

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
  const { user, loading: authLoading, role, roleLoading } = useAuth();
  const navigate = useNavigate();

  // Calculate effective roles once
  const effectiveRoles = [...allowedRoles];
  if (allowedRoles.includes("owner") && !allowedRoles.includes("developer")) {
    effectiveRoles.push("developer");
  }

  useEffect(() => {
    // Wait for both auth and role to finish loading
    if (authLoading || roleLoading) {
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    // Handle users with no role assigned
    if (role === null) {
      console.log("No role assigned, redirecting to auth");
      navigate("/auth");
      return;
    }
    
    // Check if user has required role
    if (!effectiveRoles.includes(role)) {
      console.log(`Role ${role} not in allowed roles:`, effectiveRoles);
      // Redirect based on user's actual role
      if (role === "salesman") {
        navigate("/spiff-program");
      } else if (role === "customer") {
        navigate("/customer");
      } else if (role === "developer" || role === "owner" || role === "employee") {
        navigate("/crm");
      } else {
        navigate(redirectTo);
      }
    }
  }, [user, authLoading, role, roleLoading, effectiveRoles, navigate, redirectTo]);

  // Show loading while auth or role is loading
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Don't render if no user or no role
  if (!user || role === null) {
    return null;
  }
  
  // Don't render if role not allowed
  if (!effectiveRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
};
