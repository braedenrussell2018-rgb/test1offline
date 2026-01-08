import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function QuickBooksCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const realmId = searchParams.get('realmId');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`QuickBooks authorization failed: ${error}`);
        navigate('/accounting');
        return;
      }

      if (!code || !realmId) {
        toast.error('Missing authorization parameters');
        navigate('/accounting');
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Please log in first');
          navigate('/auth');
          return;
        }

        const redirectUri = `${window.location.origin}/quickbooks/callback`;
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-auth?action=callback&code=${code}&realmId=${realmId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        const data = await response.json();
        
        if (data.success) {
          toast.success('QuickBooks connected successfully!');
          navigate('/accounting');
        } else {
          throw new Error(data.error || 'Connection failed');
        }
      } catch (err) {
        console.error('QuickBooks callback error:', err);
        toast.error('Failed to complete QuickBooks connection');
        navigate('/accounting');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-lg font-medium">Connecting to QuickBooks...</p>
        <p className="text-sm text-muted-foreground">Please wait while we complete the connection.</p>
      </div>
    </div>
  );
}
