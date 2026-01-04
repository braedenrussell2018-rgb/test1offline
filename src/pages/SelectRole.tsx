import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type PublicUserRole = "customer" | "salesman";

const ROLE_OPTIONS: { value: PublicUserRole; label: string; description: string }[] = [
  {
    value: "customer",
    label: "Customer",
    description: "View your orders, quotes, and track your purchases"
  },
  {
    value: "salesman",
    label: "Salesman",
    description: "Create quotes, track sales, and earn spiff program credits"
  },
];

export default function SelectRole() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<PublicUserRole | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelection = async () => {
    if (!selectedRole || !user) {
      toast({
        title: "Error",
        description: "Please select a role to continue",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert the user's role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: selectedRole,
        });

      if (roleError) {
        throw new Error(roleError.message);
      }

      toast({
        title: "Success!",
        description: `Your account has been set up as ${selectedRole === "customer" ? "Customer" : "Salesman"}`,
      });

      // Redirect to home page
      navigate("/");
    } catch (error) {
      console.error("Failed to set user role:", error);
      toast({
        title: "Failed to set role",
        description: error instanceof Error ? error.message : "An error occurred. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Your Account Type</CardTitle>
          <CardDescription>
            To continue, please select the type of account that best describes your role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your account was created but no role was assigned. Please select a role to access the system.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            {ROLE_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-all hover:border-primary ${
                  selectedRole === option.value ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => setSelectedRole(option.value)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={selectedRole === option.value}
                      onChange={() => setSelectedRole(option.value)}
                      className="h-4 w-4"
                    />
                    <CardTitle className="text-lg">{option.label}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    {option.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleRoleSelection}
              disabled={!selectedRole || loading}
              className="w-full"
            >
              {loading ? "Setting up your account..." : "Continue"}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Need an Employee or Owner account? Contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
