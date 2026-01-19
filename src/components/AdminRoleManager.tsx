import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserCog, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Use non-null AppRole for display purposes
type DisplayRole = Exclude<AppRole, null>;

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: DisplayRole;
  created_at: string;
}

const ROLE_COLORS: Record<DisplayRole, string> = {
  owner: "bg-red-500",
  employee: "bg-blue-500",
  salesman: "bg-green-500",
  customer: "bg-gray-500",
  developer: "bg-purple-500",
};

const ROLE_LABELS: Record<DisplayRole, string> = {
  owner: "Owner",
  employee: "Employee",
  salesman: "Salesman",
  customer: "Customer",
  developer: "Developer",
};

export function AdminRoleManager() {
  const { hasOwnerAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (hasOwnerAccess()) {
      fetchUsers();
    }
  }, [hasOwnerAccess]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users with their roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          created_at
        `);

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (roles || []).map((r) => {
        const profile = profiles?.find((p) => p.user_id === r.user_id);
        return {
          id: r.user_id,
          email: "", // We don't have direct access to auth.users
          full_name: profile?.full_name || "Unknown User",
          role: r.role as AppRole,
          created_at: r.created_at || new Date().toISOString(),
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      // Refresh list
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (roleLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!hasOwnerAccess()) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Access denied. Only owners and developers can manage user roles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>User Role Management</CardTitle>
        </div>
        <CardDescription>
          Assign and manage user roles. Only owners can access this panel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <UserCog className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Note:</strong> New users can only self-register as Customer or Salesman.
            Use this panel to promote users to Employee or Owner roles.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="text-center py-4">Loading users...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Change Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[user.role]}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                      disabled={updating === user.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="salesman">Salesman</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
