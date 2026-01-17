import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create regular client to verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the requesting user is a developer or owner
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has developer or owner role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !['developer', 'owner'].includes(roleData.role)) {
      console.error('Role check failed:', roleError, roleData);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Developer or owner role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log(`Admin user management action: ${action}`, { actorId: user.id, actorRole: roleData.role });

    switch (action) {
      case 'list_users': {
        // Get all users from auth.users using admin API
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError);
          throw listError;
        }

        // Get additional data from profiles and roles
        const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
        const { data: roles } = await supabaseAdmin.from('user_roles').select('*');
        const { data: security } = await supabaseAdmin.from('user_security_settings').select('*');

        const users = authUsers.users.map(authUser => {
          const profile = profiles?.find(p => p.user_id === authUser.id);
          const role = roles?.find(r => r.user_id === authUser.id);
          const sec = security?.find(s => s.user_id === authUser.id);
          
          return {
            id: authUser.id,
            email: authUser.email,
            full_name: profile?.full_name || authUser.user_metadata?.full_name || 'Unknown',
            role: role?.role || null,
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            email_confirmed_at: authUser.email_confirmed_at,
            phone: authUser.phone,
            mfa_enabled: sec?.mfa_enabled || false,
            account_locked: sec?.account_locked || false,
          };
        });

        return new Response(
          JSON.stringify({ users }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_user': {
        const { userId } = params;
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserError || !authUser) {
          console.error('Error getting user:', getUserError);
          throw getUserError || new Error('User not found');
        }

        // Get additional data
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).single();
        const { data: role } = await supabaseAdmin.from('user_roles').select('*').eq('user_id', userId).single();
        const { data: security } = await supabaseAdmin.from('user_security_settings').select('*').eq('user_id', userId).single();

        return new Response(
          JSON.stringify({
            user: {
              id: authUser.user.id,
              email: authUser.user.email,
              full_name: profile?.full_name || authUser.user.user_metadata?.full_name || 'Unknown',
              role: role?.role || null,
              created_at: authUser.user.created_at,
              last_sign_in_at: authUser.user.last_sign_in_at,
              email_confirmed_at: authUser.user.email_confirmed_at,
              phone: authUser.user.phone,
              mfa_enabled: security?.mfa_enabled || false,
              account_locked: security?.account_locked || false,
              user_metadata: authUser.user.user_metadata,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_email': {
        const { userId, newEmail } = params;
        if (!userId || !newEmail) {
          return new Response(
            JSON.stringify({ error: 'userId and newEmail are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Updating email for user ${userId} to ${newEmail}`);
        
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: newEmail,
          email_confirm: true, // Auto-confirm the new email
        });

        if (updateError) {
          console.error('Error updating email:', updateError);
          throw updateError;
        }

        // Log audit event
        await supabaseAdmin.from('audit_logs').insert({
          action: 'USER_EMAIL_UPDATED',
          action_category: 'USER_MANAGEMENT',
          actor_id: user.id,
          actor_role: roleData.role,
          target_id: userId,
          target_type: 'user',
          result: 'success',
          metadata: { new_email: newEmail },
        });

        return new Response(
          JSON.stringify({ success: true, user: data.user }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_password': {
        const { userId, newPassword } = params;
        if (!userId || !newPassword) {
          return new Response(
            JSON.stringify({ error: 'userId and newPassword are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (newPassword.length < 8) {
          return new Response(
            JSON.stringify({ error: 'Password must be at least 8 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Updating password for user ${userId}`);
        
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        });

        if (updateError) {
          console.error('Error updating password:', updateError);
          throw updateError;
        }

        // Log audit event
        await supabaseAdmin.from('audit_logs').insert({
          action: 'USER_PASSWORD_RESET',
          action_category: 'USER_MANAGEMENT',
          actor_id: user.id,
          actor_role: roleData.role,
          target_id: userId,
          target_type: 'user',
          result: 'success',
        });

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_user_metadata': {
        const { userId, metadata } = params;
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Updating metadata for user ${userId}`, metadata);
        
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: metadata,
        });

        if (updateError) {
          console.error('Error updating metadata:', updateError);
          throw updateError;
        }

        // Update profile if full_name is provided
        if (metadata.full_name) {
          await supabaseAdmin.from('profiles')
            .upsert({ user_id: userId, full_name: metadata.full_name, updated_at: new Date().toISOString() });
        }

        return new Response(
          JSON.stringify({ success: true, user: data.user }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_password_reset': {
        const { email } = params;
        if (!email) {
          return new Response(
            JSON.stringify({ error: 'email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Sending password reset email to ${email}`);
        
        // Use the regular client to send password reset
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: `${req.headers.get('origin')}/auth?reset=true`,
        });

        if (resetError) {
          console.error('Error sending password reset:', resetError);
          throw resetError;
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Password reset email sent' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'change_role': {
        const { userId, newRole } = params;
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const validRoles = ['employee', 'owner', 'customer', 'salesman', 'developer', null];
        if (!validRoles.includes(newRole)) {
          return new Response(
            JSON.stringify({ error: 'Invalid role. Valid roles: employee, owner, customer, salesman, developer, or null to remove' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Changing role for user ${userId} to ${newRole}`);

        if (newRole === null) {
          // Remove role
          const { error: deleteError } = await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

          if (deleteError) {
            console.error('Error removing role:', deleteError);
            throw deleteError;
          }
        } else {
          // Upsert role
          const { error: upsertError } = await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });

          if (upsertError) {
            console.error('Error updating role:', upsertError);
            throw upsertError;
          }
        }

        // Log audit event
        await supabaseAdmin.from('audit_logs').insert({
          action: 'USER_ROLE_CHANGED',
          action_category: 'USER_MANAGEMENT',
          actor_id: user.id,
          actor_role: roleData.role,
          target_id: userId,
          target_type: 'user',
          result: 'success',
          metadata: { new_role: newRole },
        });

        return new Response(
          JSON.stringify({ success: true, message: `Role ${newRole ? `changed to ${newRole}` : 'removed'}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_user': {
        const { userId: targetUserId } = params;
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent self-deletion
        if (targetUserId === user.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot delete your own account' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Deleting user ${targetUserId}`);

        // Get user info for audit log before deletion
        const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        const targetEmail = targetUser?.user?.email || 'unknown';

        // Delete from related tables first
        await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUserId);
        await supabaseAdmin.from('user_security_settings').delete().eq('user_id', targetUserId);
        await supabaseAdmin.from('profiles').delete().eq('user_id', targetUserId);
        await supabaseAdmin.from('signup_notifications').delete().eq('user_id', targetUserId);

        // Delete the auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          console.error('Error deleting user:', deleteError);
          throw deleteError;
        }

        // Log audit event
        await supabaseAdmin.from('audit_logs').insert({
          action: 'USER_DELETED',
          action_category: 'USER_MANAGEMENT',
          actor_id: user.id,
          actor_role: roleData.role,
          target_id: targetUserId,
          target_type: 'user',
          target_name: targetEmail,
          result: 'success',
          risk_level: 'high',
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User deleted successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Admin user management error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
