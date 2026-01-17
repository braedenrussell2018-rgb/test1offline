import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Users, Check, Clock, Database, Shield, Activity, Eye, Mail, Key, Edit, Search, Send, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SignupNotification {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  signed_up_at: string;
  read_at: string | null;
  created_at: string;
}

interface SystemStats {
  totalUsers: number;
  recentSignups: number;
  activeRoles: { role: string; count: number }[];
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  mfa_enabled: boolean;
  account_locked: boolean;
}

const DeveloperDashboard = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [notifications, setNotifications] = useState<SignupNotification[]>([]);
  const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, recentSignups: 0, activeRoles: [] });
  const [loading, setLoading] = useState(true);
  
  // User management state
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editType, setEditType] = useState<"email" | "password" | "name" | "role" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (user && (role === "developer" || role === "owner")) {
      fetchNotifications();
      fetchSystemStats();
    }
  }, [user, role]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("signup_notifications")
        .select("*")
        .order("signed_up_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentSignups } = await supabase
        .from("signup_notifications")
        .select("*", { count: "exact", head: true })
        .gte("signed_up_at", sevenDaysAgo.toISOString());

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role");

      const roleCounts: Record<string, number> = {};
      rolesData?.forEach((r) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });

      const activeRoles = Object.entries(roleCounts).map(([role, count]) => ({
        role,
        count,
      }));

      setStats({
        totalUsers: totalUsers || 0,
        recentSignups: recentSignups || 0,
        activeRoles,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list_users" },
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleOpenUsersDialog = () => {
    setUsersDialogOpen(true);
    fetchUsers();
  };

  const handleEditEmail = (user: UserInfo) => {
    setSelectedUser(user);
    setEditType("email");
    setEditValue(user.email);
    setEditDialogOpen(true);
  };

  const handleEditPassword = (user: UserInfo) => {
    setSelectedUser(user);
    setEditType("password");
    setEditValue("");
    setEditDialogOpen(true);
  };

  const handleEditName = (user: UserInfo) => {
    setSelectedUser(user);
    setEditType("name");
    setEditValue(user.full_name);
    setEditDialogOpen(true);
  };

  const handleChangeRole = (user: UserInfo) => {
    setSelectedUser(user);
    setEditType("role");
    setEditValue(user.role || "");
    setEditDialogOpen(true);
  };

  const handleDeleteUser = (user: UserInfo) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setProcessing(true);

    try {
      const { error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete_user", userId: userToDelete.id },
      });

      if (error) throw error;

      toast.success(`User ${userToDelete.email} deleted successfully`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
      fetchSystemStats();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setProcessing(false);
    }
  };

  const handleSendPasswordReset = async (user: UserInfo) => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "send_password_reset", email: user.email },
      });

      if (error) throw error;
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (error) {
      console.error("Error sending password reset:", error);
      toast.error("Failed to send password reset email");
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser || !editType) return;
    setProcessing(true);

    try {
      let action = "";
      let params: Record<string, unknown> = { userId: selectedUser.id };

      switch (editType) {
        case "email":
          action = "update_email";
          params.newEmail = editValue;
          break;
        case "password":
          action = "update_password";
          params.newPassword = editValue;
          break;
        case "name":
          action = "update_user_metadata";
          params.metadata = { full_name: editValue };
          break;
        case "role":
          action = "change_role";
          params.newRole = editValue === "" ? null : editValue;
          break;
      }

      const { error } = await supabase.functions.invoke("admin-user-management", {
        body: { action, ...params },
      });

      if (error) throw error;

      const successMessages: Record<string, string> = {
        email: "Email updated successfully",
        password: "Password updated successfully",
        name: "Name updated successfully",
        role: editValue ? `Role changed to ${editValue}` : "Role removed",
      };

      toast.success(successMessages[editType]);
      setEditDialogOpen(false);
      fetchUsers();
      fetchSystemStats();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(`Failed to update ${editType}`);
    } finally {
      setProcessing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("signup_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      toast.success("Marked as read");
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
      
      if (unreadIds.length === 0) {
        toast.info("No unread notifications");
        return;
      }

      const { error } = await supabase
        .from("signup_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) throw error;
      
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Developer Dashboard</h1>
          <p className="text-muted-foreground">
            System monitoring and notifications
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {role === "developer" ? "Developer" : "Owner"}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={handleOpenUsersDialog}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to manage users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Signups (7 days)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentSignups}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unread Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRoles.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications" className="relative">
            Signup Notifications
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-destructive">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles">Role Distribution</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>New User Signups</CardTitle>
                <CardDescription>
                  Notifications when new users create accounts
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No signup notifications yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border ${
                          notification.read_at
                            ? "bg-muted/50"
                            : "bg-primary/5 border-primary/20"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span className="font-medium">
                                {notification.full_name || "Unknown"}
                              </span>
                              {!notification.read_at && (
                                <Badge variant="default" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.email}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(notification.signed_up_at), "PPpp")}
                            </div>
                          </div>
                          {!notification.read_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Role Distribution</CardTitle>
              <CardDescription>
                Overview of user roles in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.activeRoles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No roles assigned yet
                  </div>
                ) : (
                  stats.activeRoles.map(({ role, count }) => (
                    <div
                      key={role}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="font-medium capitalize">{role}</span>
                      </div>
                      <Badge variant="secondary">{count} users</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Technical details about the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <span>Database Status</span>
                  </div>
                  <Badge variant="default" className="bg-green-500">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>Authentication</span>
                  </div>
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>API Status</span>
                  </div>
                  <Badge variant="default" className="bg-green-500">Operational</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Users Management Dialog */}
      <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </DialogTitle>
            <DialogDescription>
              View and manage user login information and credentials
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[400px]">
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{u.full_name}</div>
                            <div className="text-sm text-muted-foreground">{u.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {u.role || "No role"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.last_sign_in_at
                            ? format(new Date(u.last_sign_in_at), "MMM d, yyyy HH:mm")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {u.email_confirmed_at ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 text-xs">Unverified</Badge>
                            )}
                            {u.account_locked && (
                              <Badge variant="destructive" className="text-xs">Locked</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditName(u)}
                              title="Edit Name"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmail(u)}
                              title="Edit Email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleChangeRole(u)}
                              title="Change Role"
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPassword(u)}
                              title="Set Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendPasswordReset(u)}
                              disabled={processing}
                              title="Send Password Reset Email"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u)}
                              title="Delete User"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editType === "email" && "Update Email"}
              {editType === "password" && "Set New Password"}
              {editType === "name" && "Update Name"}
              {editType === "role" && "Change Role"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser && `Updating ${editType} for ${selectedUser.full_name}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editValue">
                {editType === "email" && "New Email Address"}
                {editType === "password" && "New Password"}
                {editType === "name" && "Full Name"}
                {editType === "role" && "User Role"}
              </Label>
              {editType === "role" ? (
                <Select value={editValue} onValueChange={setEditValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Role</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="salesman">Salesman</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="editValue"
                  type={editType === "password" ? "password" : "text"}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={
                    editType === "email" ? "Enter new email" :
                    editType === "password" ? "Enter new password (min 8 characters)" :
                    "Enter full name"
                  }
                />
              )}
              {editType === "password" && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              )}
              {editType === "role" && (
                <p className="text-xs text-muted-foreground">
                  Select "No Role" to remove the user's role
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={processing || (editType !== "role" && !editValue) || (editType === "password" && editValue.length < 8)}
            >
              {processing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{userToDelete?.full_name}</span> (
              {userToDelete?.email})? This action cannot be undone. All user data
              including their profile, role, and security settings will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Developer = () => {
  return (
    <RoleProtectedRoute allowedRoles={["developer", "owner"]}>
      <DeveloperDashboard />
    </RoleProtectedRoute>
  );
};

export default Developer;
