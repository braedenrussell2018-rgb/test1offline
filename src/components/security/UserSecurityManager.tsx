import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, Lock, Unlock, UserPlus, UserMinus, AlertTriangle, Search } from "lucide-react";
import { format } from "date-fns";
import { lockAccount, unlockAccount } from "@/hooks/useSecuritySettings";
import { logAuditEvent, AuditEvents } from "@/hooks/useAuditLog";

type AppRole = "employee" | "owner" | "customer" | "salesman";

interface UserSecurityInfo {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
  mfa_enabled: boolean;
  account_locked: boolean;
  account_locked_reason: string | null;
  failed_login_attempts: number;
  last_activity: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<AppRole, string> = {
  owner: "bg-red-100 text-red-800",
  employee: "bg-blue-100 text-blue-800",
  salesman: "bg-green-100 text-green-800",
  customer: "bg-gray-100 text-gray-800",
};

export function UserSecurityManager() {
  const { isOwner, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserSecurityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSecurityInfo | null>(null);
  const [actionDialog, setActionDialog] = useState<"lock" | "unlock" | "role" | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("employee");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOwner()) {
      fetchUsers();
    }
  }, [isOwner]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Fetch security settings
      const { data: security, error: securityError } = await supabase
        .from("user_security_settings")
        .select("user_id, mfa_enabled, account_locked, account_locked_reason, failed_login_attempts, last_activity");

      if (securityError) throw securityError;

      // Combine data
      const usersData: UserSecurityInfo[] = (roles || []).map((r) => {
        const profile = profiles?.find((p) => p.user_id === r.user_id);
        const sec = security?.find((s) => s.user_id === r.user_id);
        return {
          id: r.user_id,
          user_id: r.user_id,
          full_name: profile?.full_name || "Unknown User",
          role: r.role as AppRole,
          mfa_enabled: sec?.mfa_enabled || false,
          account_locked: sec?.account_locked || false,
          account_locked_reason: sec?.account_locked_reason || null,
          failed_login_attempts: sec?.failed_login_attempts || 0,
          last_activity: sec?.last_activity || null,
          created_at: r.created_at || new Date().toISOString(),
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLockAccount = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    const result = await lockAccount(selectedUser.user_id, lockReason);
    
    if (result.success) {
      await logAuditEvent(AuditEvents.ACCOUNT_LOCKED(selectedUser.user_id, lockReason || "Manual lock"));
      toast({
        title: "Account Locked",
        description: `${selectedUser.full_name}'s account has been locked`,
      });
      fetchUsers();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to lock account",
        variant: "destructive",
      });
    }

    setProcessing(false);
    setActionDialog(null);
    setSelectedUser(null);
    setLockReason("");
  };

  const handleUnlockAccount = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    const result = await unlockAccount(selectedUser.user_id);
    
    if (result.success) {
      await logAuditEvent(AuditEvents.ACCOUNT_UNLOCKED(selectedUser.user_id));
      toast({
        title: "Account Unlocked",
        description: `${selectedUser.full_name}'s account has been unlocked`,
      });
      fetchUsers();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to unlock account",
        variant: "destructive",
      });
    }

    setProcessing(false);
    setActionDialog(null);
    setSelectedUser(null);
  };

  const handleRoleChange = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;

      await logAuditEvent(AuditEvents.ROLE_CHANGED(selectedUser.user_id, selectedUser.role, newRole));
      
      toast({
        title: "Role Updated",
        description: `${selectedUser.full_name}'s role changed to ${newRole}`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }

    setProcessing(false);
    setActionDialog(null);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (roleLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!isOwner()) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Access denied. Only owners can manage user security.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>User Security Management</CardTitle>
          </div>
          <CardDescription>
            Manage user accounts, roles, and security settings. Lock/unlock accounts and enforce MFA compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="text-2xl font-bold">{users.length}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {users.filter(u => u.mfa_enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">MFA Enabled</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {users.filter(u => u.account_locked).length}
              </div>
              <div className="text-sm text-muted-foreground">Locked Accounts</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {users.filter(u => !u.mfa_enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">MFA Pending</div>
            </div>
          </div>

          {/* Users table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[user.role]}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.mfa_enabled ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          Required
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.account_locked ? (
                        <Badge variant="destructive">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.last_activity
                        ? format(new Date(user.last_activity), "MMM d, yyyy HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {user.account_locked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setActionDialog("unlock");
                            }}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setActionDialog("lock");
                            }}
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                            setActionDialog("role");
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lock Account Dialog */}
      <Dialog open={actionDialog === "lock"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Account</DialogTitle>
            <DialogDescription>
              Lock {selectedUser?.full_name}'s account. They will not be able to sign in until unlocked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for locking (required for audit)</label>
              <Input
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="e.g., Security violation, Employee termination"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLockAccount} disabled={!lockReason || processing}>
              {processing ? "Locking..." : "Lock Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Account Dialog */}
      <Dialog open={actionDialog === "unlock"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Account</DialogTitle>
            <DialogDescription>
              Unlock {selectedUser?.full_name}'s account. They will be able to sign in again.
            </DialogDescription>
          </DialogHeader>
          {selectedUser?.account_locked_reason && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Locked reason:</strong> {selectedUser.account_locked_reason}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleUnlockAccount} disabled={processing}>
              {processing ? "Unlocking..." : "Unlock Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={actionDialog === "role"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update {selectedUser?.full_name}'s role. This will affect their access permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Role</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="salesman">Salesman</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleRoleChange} disabled={processing || newRole === selectedUser?.role}>
              {processing ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
