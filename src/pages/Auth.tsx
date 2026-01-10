import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Eye, EyeOff, Check, X, Lock, Shield } from "lucide-react";
import { checkRateLimit, recordLoginAttempt } from "@/hooks/useSecuritySettings";
import { logAuditEvent, AuditEvents } from "@/hooks/useAuditLog";

// SECURITY FIX: Only allow safe self-registration roles
// Owner role must be assigned by existing owners
type PublicUserRole = "customer" | "salesman" | "employee";

const PUBLIC_ROLES: { value: PublicUserRole; label: string; description: string }[] = [
  { value: "employee", label: "Employee", description: "Internal staff member" },
  { value: "customer", label: "Customer", description: "View your orders and quotes" },
  { value: "salesman", label: "Salesman", description: "Create quotes and track commissions" },
];

// Password requirements
const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%^&*)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  
  const results = PASSWORD_REQUIREMENTS.map(req => ({
    ...req,
    passed: req.test(password)
  }));
  
  const passedCount = results.filter(r => r.passed).length;
  const strength = (passedCount / PASSWORD_REQUIREMENTS.length) * 100;
  
  const getStrengthLabel = () => {
    if (strength < 40) return { label: "Weak", color: "bg-red-500" };
    if (strength < 80) return { label: "Medium", color: "bg-yellow-500" };
    return { label: "Strong", color: "bg-green-500" };
  };
  
  const strengthInfo = getStrengthLabel();
  
  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password strength</span>
        <span className={strength >= 80 ? "text-green-500" : strength >= 40 ? "text-yellow-500" : "text-red-500"}>
          {strengthInfo.label}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${strengthInfo.color}`}
          style={{ width: `${strength}%` }}
        />
      </div>
      <ul className="space-y-1 text-xs">
        {results.map((req, i) => (
          <li key={i} className="flex items-center gap-1">
            {req.passed ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={req.passed ? "text-green-500" : "text-muted-foreground"}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every(req => req.test(password));
}

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<PublicUserRole>("employee");
  const [loading, setLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    blocked: boolean;
    remaining: number;
    lockoutMinutes: number;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email || !password || !fullName || !role) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Strong password validation
    if (!isPasswordValid(password)) {
      toast({
        title: "Weak Password",
        description: "Please meet all password requirements",
        variant: "destructive",
      });
      return;
    }

    // Name validation
    if (fullName.trim().length < 2) {
      toast({
        title: "Error",
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }

    // SECURITY: Validate role is in allowed list (defense in depth)
    if (!PUBLIC_ROLES.some(r => r.value === role)) {
      toast({
        title: "Error",
        description: "Invalid role selected",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (authError) {
      setLoading(false);
      toast({
        title: "Sign up failed",
        description: authError.message,
        variant: "destructive",
      });
      return;
    }

    if (authData.user) {
      // Insert role - the database trigger will validate this
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: role, // Only "customer" or "salesman" allowed
        });

      if (roleError) {
        console.error("Failed to set user role:", roleError);
        // The trigger should prevent invalid roles, log for monitoring
      }
    }

    setLoading(false);
    toast({
      title: "Success!",
      description: "Account created successfully. Please check your email to verify your account, then log in.",
    });
    
    // Clear form
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("employee");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter your email and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Check rate limit before attempting login
    const rateLimitStatus = await checkRateLimit(email);
    
    if (!rateLimitStatus.allowed) {
      setLoading(false);
      setRateLimitInfo({
        blocked: true,
        remaining: rateLimitStatus.remaining,
        lockoutMinutes: rateLimitStatus.lockout_minutes_remaining,
      });
      
      if (rateLimitStatus.account_locked) {
        toast({
          title: "Account Locked",
          description: "Your account has been locked due to too many failed login attempts. Please contact an administrator.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Too Many Attempts",
          description: `Please wait ${rateLimitStatus.lockout_minutes_remaining} minutes before trying again.`,
          variant: "destructive",
        });
      }
      
      await logAuditEvent(AuditEvents.LOGIN_FAILED(email, 'Rate limited'));
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      
      // Record failed attempt
      await recordLoginAttempt(email, false);
      
      // Update rate limit info
      const newStatus = await checkRateLimit(email);
      setRateLimitInfo({
        blocked: !newStatus.allowed,
        remaining: newStatus.remaining,
        lockoutMinutes: newStatus.lockout_minutes_remaining,
      });
      
      await logAuditEvent(AuditEvents.LOGIN_FAILED(email, error.message));
      
      toast({
        title: "Sign in failed",
        description: newStatus.remaining <= 2 
          ? `${error.message}. ${newStatus.remaining} attempts remaining.`
          : error.message,
        variant: "destructive",
      });
      return;
    }

    // Record successful login
    await recordLoginAttempt(email, true);
    await logAuditEvent(AuditEvents.LOGIN_SUCCESS(email));
    
    setLoading(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Serial Stock Suite</CardTitle>
          <CardDescription>
            Company management made simple
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {rateLimitInfo?.blocked && (
                <Alert variant="destructive" className="mb-4">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    {rateLimitInfo.lockoutMinutes > 0 
                      ? `Too many failed attempts. Please wait ${rateLimitInfo.lockoutMinutes} minutes.`
                      : "Your account is locked. Please contact an administrator."}
                  </AlertDescription>
                </Alert>
              )}
              
              {rateLimitInfo && !rateLimitInfo.blocked && rateLimitInfo.remaining <= 3 && (
                <Alert className="mb-4">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    {rateLimitInfo.remaining} login attempts remaining before temporary lockout.
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-role">Account Type</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as PublicUserRole)}>
                    <SelectTrigger id="signup-role">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLIC_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex flex-col">
                            <span>{r.label}</span>
                            <span className="text-xs text-muted-foreground">{r.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Need an Owner account? Contact your administrator.
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !isPasswordValid(password)}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
