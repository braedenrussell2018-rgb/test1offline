import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

const QUICKBOOKS_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID');
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// QuickBooks OAuth endpoints
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight(req);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Generate authorization URL
    if (action === 'authorize') {
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = crypto.randomUUID();
      
      const authUrl = new URL(QB_AUTH_URL);
      authUrl.searchParams.set('client_id', QUICKBOOKS_CLIENT_ID!);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
      authUrl.searchParams.set('redirect_uri', redirectUri!);
      authUrl.searchParams.set('state', state);

      console.log('Generated QuickBooks auth URL');
      
      return new Response(JSON.stringify({ 
        authUrl: authUrl.toString(),
        state 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Exchange authorization code for tokens
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const realmId = url.searchParams.get('realmId');
      const redirectUri = url.searchParams.get('redirect_uri');

      if (!code || !realmId) {
        throw new Error('Missing code or realmId');
      }

      console.log('Exchanging code for tokens, realmId:', realmId);

      // Exchange code for tokens
      const tokenResponse = await fetch(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri!
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get user from auth header
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        throw new Error('No authorization header');
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Decode JWT to get user ID
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
      
      if (userError || !user) {
        throw new Error('Invalid user token');
      }

      // Store tokens securely
      const { error: upsertError } = await supabase
        .from('quickbooks_connections')
        .upsert({
          user_id: user.id,
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          refresh_token_expires_at: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000).toISOString(),
          connected_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Failed to store tokens:', upsertError);
        throw new Error('Failed to store connection');
      }

      console.log('QuickBooks connection stored for user:', user.id);

      return new Response(JSON.stringify({ 
        success: true,
        realmId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check connection status
    if (action === 'status') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);

      if (!user) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: connection } = await supabase
        .from('quickbooks_connections')
        .select('realm_id, connected_at, token_expires_at')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ 
        connected: !!connection,
        realmId: connection?.realm_id,
        connectedAt: connection?.connected_at,
        tokenExpiresAt: connection?.token_expires_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Disconnect
    if (action === 'disconnect') {
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

      await supabase
        .from('quickbooks_connections')
        .delete()
        .eq('user_id', user.id);

      console.log('QuickBooks disconnected for user:', user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('QuickBooks auth error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
