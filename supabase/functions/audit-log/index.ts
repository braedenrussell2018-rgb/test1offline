import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

interface AuditLogEntry {
  action: string;
  action_category: 'auth' | 'data_access' | 'data_modification' | 'admin' | 'export' | 'security';
  target_type?: string;
  target_id?: string;
  target_name?: string;
  result?: 'success' | 'failure' | 'blocked';
  failure_reason?: string;
  metadata?: Record<string, unknown>;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    return handleCorsPrelight(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for inserting logs (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info from auth header if present
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userRole: string | null = null;

    if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
        
        // Get user role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        userRole = roleData?.role || null;
      }
    }

    // Parse request body
    const body: AuditLogEntry = await req.json();

    // Extract request metadata
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     null;
    const userAgent = req.headers.get("user-agent") || null;
    const sessionId = req.headers.get("x-session-id") || null;

    // Validate required fields
    if (!body.action || !body.action_category) {
      return new Response(
        JSON.stringify({ error: "action and action_category are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert audit log
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        actor_id: userId,
        actor_email: userEmail,
        actor_role: userRole,
        action: body.action,
        action_category: body.action_category,
        target_type: body.target_type,
        target_id: body.target_id,
        target_name: body.target_name,
        result: body.result || 'success',
        failure_reason: body.failure_reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
        metadata: body.metadata || {},
        risk_level: body.risk_level || 'low',
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert audit log:", error);
      return new Response(
        JSON.stringify({ error: "Failed to log audit event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, log_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Audit log error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
