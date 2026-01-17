import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

interface Employee {
  user_id: string;
  full_name: string;
  role: string;
}

interface EmployeeSelectorProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function EmployeeSelector({ selectedUserId, onSelectUser }: EmployeeSelectorProps) {
  const { hasOwnerAccess } = useUserRole();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasOwnerAccess()) {
      loadEmployees();
    }
  }, [hasOwnerAccess]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["employee", "owner", "developer"]);

      if (error) throw error;

      // Get profiles for these users
      const userIds = data?.map(d => d.user_id) || [];
      
      if (userIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const combined = data?.map(d => {
        const profile = profiles?.find(p => p.user_id === d.user_id);
        return {
          user_id: d.user_id,
          full_name: profile?.full_name || "Unknown User",
          role: d.role
        };
      }) || [];

      // Sort by name
      combined.sort((a, b) => a.full_name.localeCompare(b.full_name));
      
      setEmployees(combined);
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      setLoading(false);
    }
  };

  // Only show for owners and developers
  if (!hasOwnerAccess()) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-48 h-9 bg-muted animate-pulse rounded-md" />
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner": return "Owner";
      case "developer": return "Developer";
      case "employee": return "Employee";
      default: return role;
    }
  };

  return (
    <Select
      value={selectedUserId || user?.id || ""}
      onValueChange={onSelectUser}
    >
      <SelectTrigger className="w-48">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Select employee" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {employees.map((emp) => (
          <SelectItem key={emp.user_id} value={emp.user_id}>
            <div className="flex items-center gap-2">
              <span>{emp.full_name}</span>
              <span className="text-xs text-muted-foreground">({getRoleLabel(emp.role)})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
