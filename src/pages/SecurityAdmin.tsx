import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserSecurityManager } from "@/components/security/UserSecurityManager";
import { AuditLogViewer } from "@/components/security/AuditLogViewer";
import { MFASetup } from "@/components/security/MFASetup";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import { Shield, Users, FileText, Key, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

function SecurityDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Security Administration</h1>
          <p className="text-muted-foreground">
            SOC 2 Type I compliant security management dashboard
          </p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          This dashboard provides tools for SOC 2 compliance: user provisioning, MFA enforcement, 
          role management, account suspension, and audit log review.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Audit Logs</span>
          </TabsTrigger>
          <TabsTrigger value="mfa" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">My MFA</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserSecurityManager />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>

        <TabsContent value="mfa">
          <MFASetup />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure organization-wide security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Session Timeout</h3>
                  <p className="text-sm text-muted-foreground">
                    Users are automatically logged out after 30 minutes of inactivity.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Rate Limiting</h3>
                  <p className="text-sm text-muted-foreground">
                    5 failed login attempts triggers 15-minute lockout. Automatic account lock after multiple lockouts.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Password Policy</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum 8 characters, uppercase, lowercase, number, and special character required.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">MFA Requirement</h3>
                  <p className="text-sm text-muted-foreground">
                    Multi-factor authentication is required for all user accounts per SOC 2.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SecurityAdmin() {
  return (
    <RoleProtectedRoute allowedRoles={["owner"]} redirectTo="/">
      <SecurityDashboard />
    </RoleProtectedRoute>
  );
}
