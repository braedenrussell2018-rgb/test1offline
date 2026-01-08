import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Link2, Unlink, Building2, FileText, Receipt, CheckCircle } from "lucide-react";

interface QuickBooksConnectionProps {
  onSyncComplete?: () => void;
}

interface ConnectionStatus {
  connected: boolean;
  realmId?: string;
  connectedAt?: string;
  companyName?: string;
}

export function QuickBooksConnection({ onSyncComplete }: QuickBooksConnectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<{ invoices: number; expenses: number } | null>(null);

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-auth?action=status`,
        {
          headers: session?.access_token ? {
            'Authorization': `Bearer ${session.access_token}`
          } : {}
        }
      );

      const data = await response.json();
      
      if (data.connected) {
        // Fetch company info
        const companyResponse = await supabase.functions.invoke('quickbooks-sync', {
          body: { action: 'company_info' }
        });
        
        setStatus({
          connected: true,
          realmId: data.realmId,
          connectedAt: data.connectedAt,
          companyName: companyResponse.data?.companyInfo?.CompanyName
        });
      } else {
        setStatus({ connected: false });
      }
    } catch (error) {
      console.error('Failed to check QuickBooks status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const realmId = urlParams.get('realmId');
    
    if (code && realmId) {
      handleCallback(code, realmId);
    }
  }, []);

  const handleCallback = async (code: string, realmId: string) => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const redirectUri = `${window.location.origin}/quickbooks/callback`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-auth?action=callback&code=${code}&realmId=${realmId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('QuickBooks connected successfully!');
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        await checkStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Callback error:', error);
      toast.error('Failed to connect QuickBooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const redirectUri = `${window.location.origin}/quickbooks/callback`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`
      );

      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast.error('Failed to initiate QuickBooks connection');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-auth?action=disconnect`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('QuickBooks disconnected');
        setStatus({ connected: false });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect QuickBooks');
    } finally {
      setIsLoading(false);
    }
  };

  const syncInvoices = async () => {
    try {
      // Fetch local invoices
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let synced = 0;
      for (const invoice of invoices || []) {
        const { data, error: syncError } = await supabase.functions.invoke('quickbooks-sync', {
          body: { action: 'sync_invoice', data: invoice }
        });

        if (syncError) {
          console.error('Invoice sync error:', syncError);
        } else if (data?.success) {
          synced++;
        }
      }

      return synced;
    } catch (error) {
      console.error('Sync invoices error:', error);
      return 0;
    }
  };

  const syncExpenses = async () => {
    try {
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let synced = 0;
      for (const expense of expenses || []) {
        const { data, error: syncError } = await supabase.functions.invoke('quickbooks-sync', {
          body: { action: 'sync_expense', data: expense }
        });

        if (syncError) {
          console.error('Expense sync error:', syncError);
        } else if (data?.success) {
          synced++;
        }
      }

      return synced;
    } catch (error) {
      console.error('Sync expenses error:', error);
      return 0;
    }
  };

  const handleFullSync = async () => {
    try {
      setIsSyncing(true);
      toast.info('Starting QuickBooks sync...');

      const [invoiceCount, expenseCount] = await Promise.all([
        syncInvoices(),
        syncExpenses()
      ]);

      setSyncStats({ invoices: invoiceCount, expenses: expenseCount });
      toast.success(`Synced ${invoiceCount} invoices and ${expenseCount} expenses to QuickBooks`);
      onSyncComplete?.();
    } catch (error) {
      console.error('Full sync error:', error);
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Integration</CardTitle>
              <CardDescription>
                Sync invoices and expenses with QuickBooks Online
              </CardDescription>
            </div>
          </div>
          <Badge variant={status.connected ? "default" : "secondary"}>
            {status.connected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : status.connected ? (
          <>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">{status.companyName || 'Connected Company'}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Company ID: {status.realmId}
              </p>
              {status.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  Connected: {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {syncStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{syncStats.invoices} Invoices</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last sync</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">{syncStats.expenses} Expenses</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last sync</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleFullSync} 
                disabled={isSyncing}
                className="flex-1"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDisconnect}>
                <Unlink className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your QuickBooks Online account to automatically sync invoices and expenses.
            </p>
            <Button onClick={handleConnect} className="w-full">
              <Link2 className="mr-2 h-4 w-4" />
              Connect QuickBooks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
