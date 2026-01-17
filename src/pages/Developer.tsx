import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Users, Check, Clock, Database, Shield, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";

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

const DeveloperDashboard = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [notifications, setNotifications] = useState<SignupNotification[]>([]);
  const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, recentSignups: 0, activeRoles: [] });
  const [loading, setLoading] = useState(true);

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
      // Get total users from profiles
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get recent signups (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentSignups } = await supabase
        .from("signup_notifications")
        .select("*", { count: "exact", head: true })
        .gte("signed_up_at", sevenDaysAgo.toISOString());

      // Get role distribution
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
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
