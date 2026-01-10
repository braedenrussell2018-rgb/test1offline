import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginAttemptPayload {
  action: 'check_rate_limit' | 'record_attempt' | 'unlock_account' | 'lock_account';
  email?: string;
  success?: boolean;
  user_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: LoginAttemptPayload = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    switch (body.action) {
      case 'check_rate_limit': {
        if (!body.email) {
          return new Response(
            JSON.stringify({ error: "email is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const emailToCheck = body.email.toLowerCase();

        // Check failed attempts in last 15 minutes
        const { data: attempts, error: attemptsError } = await supabaseAdmin
          .from("login_attempts")
          .select("id, attempted_at")
          .eq("email", emailToCheck)
          .eq("success", false)
          .gte("attempted_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .order("attempted_at", { ascending: false });

        if (attemptsError) {
          console.error("Error checking rate limit:", attemptsError);
          return new Response(
            JSON.stringify({ allowed: true }), // Fail open
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const failedCount = attempts?.length || 0;
        const maxAttempts = 5;
        const isBlocked = failedCount >= maxAttempts;

        // Check if account is locked
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        const matchedUser = allUsers?.users.find(u => u.email === emailToCheck);
        
        let userData = null;
        if (matchedUser) {
          const { data } = await supabaseAdmin
            .from("user_security_settings")
            .select("account_locked, user_id")
            .eq("user_id", matchedUser.id)
            .single();
          userData = data;
        }

        const lockoutMinutesRemaining = isBlocked && attempts && attempts.length > 0
          ? Math.max(0, 15 - Math.floor((Date.now() - new Date(attempts[0].attempted_at).getTime()) / 60000))
          : 0;

        return new Response(
          JSON.stringify({
            allowed: !isBlocked && !userData?.account_locked,
            failed_attempts: failedCount,
            max_attempts: maxAttempts,
            remaining: Math.max(0, maxAttempts - failedCount),
            account_locked: userData?.account_locked || false,
            lockout_minutes_remaining: lockoutMinutesRemaining
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'record_attempt': {
        if (!body.email) {
          return new Response(
            JSON.stringify({ error: "email is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const recordEmail = body.email!.toLowerCase();

        // Record the login attempt
        await supabaseAdmin
          .from("login_attempts")
          .insert({
            email: recordEmail,
            ip_address: ipAddress,
            success: body.success || false,
            user_agent: userAgent,
          });

        // If failed, update user security settings
        if (!body.success) {
          const { data: users } = await supabaseAdmin.auth.admin.listUsers();
          const user = users?.users.find(u => u.email === recordEmail);
          
          if (user) {
            // Check current failed attempts
            const { data: settings } = await supabaseAdmin
              .from("user_security_settings")
              .select("*")
              .eq("user_id", user.id)
              .single();

            const newCount = (settings?.failed_login_attempts || 0) + 1;
            const shouldLock = newCount >= 5;

            await supabaseAdmin
              .from("user_security_settings")
              .upsert({
                user_id: user.id,
                failed_login_attempts: newCount,
                last_failed_login: new Date().toISOString(),
                account_locked: shouldLock,
                account_locked_at: shouldLock ? new Date().toISOString() : settings?.account_locked_at,
                account_locked_reason: shouldLock ? 'Too many failed login attempts' : settings?.account_locked_reason,
              });

            // Log security event
            await supabaseAdmin
              .from("audit_logs")
              .insert({
                action: shouldLock ? 'account_locked' : 'login_failed',
                action_category: 'auth',
                target_type: 'user',
                target_id: user.id,
                target_name: user.email,
                result: 'failure',
                failure_reason: shouldLock ? 'Account locked due to too many failed attempts' : 'Invalid credentials',
                ip_address: ipAddress,
                user_agent: userAgent,
                risk_level: shouldLock ? 'high' : 'medium',
              });
          }
        } else {
          // Successful login - reset failed attempts
          const { data: users } = await supabaseAdmin.auth.admin.listUsers();
          const user = users?.users.find(u => u.email === recordEmail);
          
          if (user) {
            await supabaseAdmin
              .from("user_security_settings")
              .upsert({
                user_id: user.id,
                failed_login_attempts: 0,
                last_activity: new Date().toISOString(),
              });

            // Log successful login
            await supabaseAdmin
              .from("audit_logs")
              .insert({
                actor_id: user.id,
                actor_email: user.email,
                action: 'login_success',
                action_category: 'auth',
                target_type: 'user',
                target_id: user.id,
                result: 'success',
                ip_address: ipAddress,
                user_agent: userAgent,
                risk_level: 'low',
              });
          }
        }

        return new Response(
          JSON.stringify({ recorded: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'unlock_account': {
        if (!body.user_id) {
          return new Response(
            JSON.stringify({ error: "user_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify caller is owner
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if caller is owner
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (roleData?.role !== 'owner') {
          return new Response(
            JSON.stringify({ error: "Only owners can unlock accounts" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Unlock the account
        await supabaseAdmin
          .from("user_security_settings")
          .update({
            account_locked: false,
            account_locked_at: null,
            account_locked_reason: null,
            failed_login_attempts: 0,
          })
          .eq("user_id", body.user_id);

        // Log the action
        await supabaseAdmin
          .from("audit_logs")
          .insert({
            actor_id: user.id,
            actor_email: user.email,
            action: 'account_unlocked',
            action_category: 'admin',
            target_type: 'user',
            target_id: body.user_id,
            result: 'success',
            ip_address: ipAddress,
            user_agent: userAgent,
            risk_level: 'medium',
          });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'lock_account': {
        if (!body.user_id) {
          return new Response(
            JSON.stringify({ error: "user_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify caller is owner (same as unlock)
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (roleData?.role !== 'owner') {
          return new Response(
            JSON.stringify({ error: "Only owners can lock accounts" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevent self-lock
        if (body.user_id === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot lock your own account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Lock the account
        await supabaseAdmin
          .from("user_security_settings")
          .update({
            account_locked: true,
            account_locked_at: new Date().toISOString(),
            account_locked_reason: body.reason || 'Manually locked by administrator',
          })
          .eq("user_id", body.user_id);

        // Log the action
        await supabaseAdmin
          .from("audit_logs")
          .insert({
            actor_id: user.id,
            actor_email: user.email,
            action: 'account_locked_manual',
            action_category: 'admin',
            target_type: 'user',
            target_id: body.user_id,
            result: 'success',
            metadata: { reason: body.reason },
            ip_address: ipAddress,
            user_agent: userAgent,
            risk_level: 'high',
          });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Security check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
