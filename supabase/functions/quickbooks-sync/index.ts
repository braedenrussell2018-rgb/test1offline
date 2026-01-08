import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUICKBOOKS_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID');
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<string> {
  const tokenExpiry = new Date(connection.token_expires_at);
  const now = new Date();
  
  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  console.log('Refreshing QuickBooks token...');

  const response = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token
    })
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await response.json();

  await supabase
    .from('quickbooks_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000).toISOString()
    })
    .eq('user_id', connection.user_id);

  console.log('Token refreshed successfully');
  return tokens.access_token;
}

async function qbRequest(accessToken: string, realmId: string, endpoint: string, method = 'GET', body?: any) {
  const url = `${QB_API_BASE}/${realmId}/${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks API error:', response.status, errorText);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Not authenticated');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(jwt);

    if (!user) {
      throw new Error('Invalid user');
    }

    // Get QuickBooks connection
    const { data: connection, error: connError } = await supabase
      .from('quickbooks_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      throw new Error('QuickBooks not connected');
    }

    const accessToken = await refreshTokenIfNeeded(supabase, connection);
    const realmId = connection.realm_id;

    const { action, data } = await req.json();

    // Sync invoices to QuickBooks
    if (action === 'sync_invoice') {
      const invoice = data;
      
      // First, find or create customer
      let customerId: string;
      
      // Query for existing customer
      const customerQuery = await qbRequest(
        accessToken, 
        realmId, 
        `query?query=select * from Customer where DisplayName = '${invoice.customer_name.replace(/'/g, "\\'")}'`
      );

      if (customerQuery.QueryResponse?.Customer?.length > 0) {
        customerId = customerQuery.QueryResponse.Customer[0].Id;
      } else {
        // Create new customer
        const newCustomer = await qbRequest(accessToken, realmId, 'customer', 'POST', {
          DisplayName: invoice.customer_name,
          PrimaryEmailAddr: invoice.customer_email ? { Address: invoice.customer_email } : undefined,
          PrimaryPhone: invoice.customer_phone ? { FreeFormNumber: invoice.customer_phone } : undefined,
          BillAddr: invoice.customer_address ? { Line1: invoice.customer_address } : undefined
        });
        customerId = newCustomer.Customer.Id;
        console.log('Created QuickBooks customer:', customerId);
      }

      // Create invoice in QuickBooks
      const items = Array.isArray(invoice.items) ? invoice.items : JSON.parse(invoice.items || '[]');
      
      const qbInvoice = {
        CustomerRef: { value: customerId },
        Line: items.map((item: any, index: number) => ({
          LineNum: index + 1,
          Amount: item.sale_price || item.cost || 0,
          DetailType: 'SalesItemLineDetail',
          Description: `${item.description} (${item.part_number})`,
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: item.sale_price || item.cost || 0
          }
        })),
        DocNumber: invoice.invoice_number
      };

      if (invoice.shipping && invoice.shipping > 0) {
        qbInvoice.Line.push({
          LineNum: items.length + 1,
          Amount: invoice.shipping,
          DetailType: 'SalesItemLineDetail',
          Description: 'Shipping',
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: invoice.shipping
          }
        });
      }

      const createdInvoice = await qbRequest(accessToken, realmId, 'invoice', 'POST', qbInvoice);
      console.log('Created QuickBooks invoice:', createdInvoice.Invoice.Id);

      // Store sync record
      await supabase.from('quickbooks_sync_log').insert({
        user_id: user.id,
        entity_type: 'invoice',
        local_id: invoice.id,
        quickbooks_id: createdInvoice.Invoice.Id,
        sync_direction: 'to_quickbooks',
        status: 'success'
      });

      return new Response(JSON.stringify({ 
        success: true, 
        quickbooksId: createdInvoice.Invoice.Id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sync expense to QuickBooks
    if (action === 'sync_expense') {
      const expense = data;

      // Find or create vendor/expense account
      const expenseData = {
        PaymentType: 'Cash',
        TotalAmt: expense.amount,
        TxnDate: expense.expense_date,
        Line: [{
          DetailType: 'AccountBasedExpenseLineDetail',
          Amount: expense.amount,
          Description: expense.description || expense.category,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: '1' } // Default expense account
          }
        }],
        PrivateNote: `${expense.category} - ${expense.employee_name}`
      };

      const createdExpense = await qbRequest(accessToken, realmId, 'purchase', 'POST', expenseData);
      console.log('Created QuickBooks expense:', createdExpense.Purchase.Id);

      await supabase.from('quickbooks_sync_log').insert({
        user_id: user.id,
        entity_type: 'expense',
        local_id: expense.id,
        quickbooks_id: createdExpense.Purchase.Id,
        sync_direction: 'to_quickbooks',
        status: 'success'
      });

      return new Response(JSON.stringify({ 
        success: true, 
        quickbooksId: createdExpense.Purchase.Id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get company info
    if (action === 'company_info') {
      const companyInfo = await qbRequest(accessToken, realmId, 'companyinfo/' + realmId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        companyInfo: companyInfo.CompanyInfo 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch accounts from QuickBooks
    if (action === 'fetch_accounts') {
      const accounts = await qbRequest(
        accessToken, 
        realmId, 
        'query?query=select * from Account MAXRESULTS 1000'
      );

      return new Response(JSON.stringify({ 
        success: true, 
        accounts: accounts.QueryResponse?.Account || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch recent transactions
    if (action === 'fetch_transactions') {
      const startDate = data?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const invoices = await qbRequest(
        accessToken, 
        realmId, 
        `query?query=select * from Invoice where TxnDate >= '${startDate}' MAXRESULTS 100`
      );

      const purchases = await qbRequest(
        accessToken, 
        realmId, 
        `query?query=select * from Purchase where TxnDate >= '${startDate}' MAXRESULTS 100`
      );

      return new Response(JSON.stringify({ 
        success: true, 
        invoices: invoices.QueryResponse?.Invoice || [],
        purchases: purchases.QueryResponse?.Purchase || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
