import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, ShieldAlert, Smartphone, Key, Copy, Check } from "lucide-react";
import { logAuditEvent, AuditEvents } from "@/hooks/useAuditLog";

interface MFAFactor {
  id: string;
  factor_type: string;
  status: string;
  created_at: string;
  friendly_name?: string;
}

export function MFASetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFactors();
    }
  }, [user]);

  const fetchFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      setFactors(data?.totp || []);
    } catch (error) {
      console.error("Error fetching MFA factors:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (error) {
      console.error("MFA enrollment error:", error);
      toast({
        title: "Enrollment Failed",
        description: error instanceof Error ? error.message : "Failed to start MFA enrollment",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyAndEnroll = async () => {
    if (!factorId || verifyCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setEnrolling(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update security settings
      if (user) {
        await supabase
          .from("user_security_settings")
          .update({ 
            mfa_enabled: true,
            mfa_verified_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      await logAuditEvent({
        action: 'mfa_enabled',
        action_category: 'security',
        target_type: 'user',
        target_id: user?.id,
        result: 'success',
        risk_level: 'high',
      });

      toast({
        title: "MFA Enabled",
        description: "Two-factor authentication has been successfully enabled",
      });

      setShowEnrollDialog(false);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode("");
      fetchFactors();
    } catch (error) {
      console.error("MFA verification error:", error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const unenroll = async (id: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;

      // Update security settings
      if (user) {
        await supabase
          .from("user_security_settings")
          .update({ 
            mfa_enabled: false,
            mfa_verified_at: null,
          })
          .eq("user_id", user.id);
      }

      await logAuditEvent({
        action: 'mfa_disabled',
        action_category: 'security',
        target_type: 'user',
        target_id: user?.id,
        result: 'success',
        risk_level: 'critical',
      });

      toast({
        title: "MFA Disabled",
        description: "Two-factor authentication has been removed",
      });

      fetchFactors();
    } catch (error) {
      console.error("MFA unenroll error:", error);
      toast({
        title: "Error",
        description: "Failed to disable MFA",
        variant: "destructive",
      });
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasActiveMFA = factors.some(f => f.status === 'verified');

  if (loading) {
    return <div className="p-4">Loading security settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {hasActiveMFA ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
          )}
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasActiveMFA && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>SOC 2 Requirement:</strong> Multi-factor authentication is required for all user accounts.
              Please enable MFA to comply with security policies.
            </AlertDescription>
          </Alert>
        )}

        {factors.filter(f => f.status === 'verified').length > 0 && (
          <div className="space-y-2">
            <Label>Active Authenticators</Label>
            {factors.filter(f => f.status === 'verified').map((factor) => (
              <div key={factor.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span>{factor.friendly_name || 'Authenticator App'}</span>
                  <span className="text-xs text-muted-foreground">
                    Added {new Date(factor.created_at).toLocaleDateString()}
                  </span>
                </div>
                <Button variant="destructive" size="sm" onClick={() => unenroll(factor.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {!hasActiveMFA && (
          <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
            <DialogTrigger asChild>
              <Button onClick={startEnrollment} disabled={enrolling}>
                <Key className="h-4 w-4 mr-2" />
                {enrolling ? "Setting up..." : "Enable MFA"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {qrCode && (
                  <div className="flex justify-center">
                    <img src={qrCode} alt="MFA QR Code" className="border rounded-lg" />
                  </div>
                )}
                
                {secret && (
                  <div className="space-y-2">
                    <Label>Or enter this code manually:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded font-mono text-sm break-all">
                        {secret}
                      </code>
                      <Button variant="outline" size="sm" onClick={copySecret}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="verify-code">Verification Code</Label>
                  <Input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={verifyAndEnroll}
                  disabled={enrolling || verifyCode.length !== 6}
                >
                  {enrolling ? "Verifying..." : "Verify and Enable"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {hasActiveMFA && (
          <Alert className="border-green-200 bg-green-50">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              Two-factor authentication is active. Your account is protected.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
