## Root cause

Every table in the `public` schema currently has **zero** privileges granted to `authenticated`, `anon`, or `service_role`, and every RLS helper function (`has_role`, `is_tenant_member`, `has_tenant_role`, `is_global_developer`, `can_access_tenant`, `current_tenant_id`, `get_user_role`) has had `EXECUTE` revoked from `authenticated`.

Effect:
- The auth login itself succeeds (that hits `auth.users`, not `public`).
- Immediately after sign-in, `useAuth` runs `supabase.from("user_roles").select("role")`. The Data API rejects it because `authenticated` has no `SELECT` on `public.user_roles`. The client treats this as "no role assigned" and `RoleProtectedRoute` bounces back to `/auth` in a loop — exactly what the console log `"No role assigned, redirecting to auth"` shows repeatedly.
- Even if a row were returned, every other table query in the app would fail the same way, and every RLS policy that calls `has_role(...)` / `is_tenant_member(...)` would fail because `authenticated` cannot execute those helpers.

This regression came from the over-aggressive "security hardening" migration that revoked EXECUTE on SECURITY DEFINER helpers in response to Supabase linter findings `SUPA_anon_security_definer_function_executable` and `SUPA_authenticated_security_definer_function_executable`. Those findings are false positives for helpers that are required inside RLS policies.

## Fix

One migration that:

1. **Restore table grants** on every `public` table, scoped to what the RLS policies actually allow.
   - User-facing tables: `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated; GRANT ALL TO service_role;`
   - Auth-only / no-anon tables (`user_roles`, `user_security_settings`, `tenant_members`, `tenants`, `audit_logs`, `login_attempts`, `signup_notifications`, `data_export_logs`, `quickbooks_connections`, `quickbooks_sync_log`, `profiles`, `accounts`, `account_transactions`, `branches`, `budget_forecasts`, `calendar_events`, `calendar_event_invitees`, `companies`, `company_meetings`, `expenses`, `internal_notes`, `invoices`, `items`, `meeting_chat_messages`, `people`, `purchase_orders`, `purchase_order_items`, `quotes`, `spiff_prizes`, `spiff_program`, `spiff_warranties`, `tenant_invites`, `user_ai_settings`, `vendors`, `video_meetings`, `video_meeting_participants`, `ai_conversations`, `geocode_cache`): no `anon` grant.
   - `login_attempts`, `audit_logs`, `signup_notifications`: keep client INSERT blocked by the existing RESTRICTIVE policies; service role handles writes.

2. **Re-GRANT EXECUTE** on the RLS-evaluation helpers to `authenticated` (and `anon` only where policies allow anonymous access):
   ```
   GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role),
                              public.is_tenant_member(uuid, uuid),
                              public.has_tenant_role(uuid, uuid, app_role[]),
                              public.is_global_developer(uuid),
                              public.can_access_tenant(uuid),
                              public.current_tenant_id(uuid),
                              public.get_user_role(uuid)
     TO authenticated;
   ```
   These must remain callable because every RLS policy on every tenant-scoped table invokes them. Without this, all reads/writes fail even when a grant exists.

3. **Leave revoked** the helpers that are only meant for triggers / RPCs already accessed through wrappers: `encrypt_token`, `decrypt_token`, `encrypt_email`, `decrypt_email`, `store_qb_tokens`, `update_qb_tokens`, `get_qb_tokens` (clients call `get_qb_tokens` only — re-grant just that one), `handle_new_user*`, `assign_default_employee_role`, `soft_delete_people`, `generate_meeting_code`, `protect_user_security_settings`, `update_updated_at_column`.

4. **Mark the two Supabase linter findings as ignored** (`SUPA_anon_security_definer_function_executable`, `SUPA_authenticated_security_definer_function_executable`) with an explanation that the listed helpers must be executable by `authenticated` because they are referenced inside RLS policy expressions, and update `@security-memory` so the scanner does not flag them again.

## Verification

After applying the migration:
- `SELECT role FROM public.user_roles WHERE user_id = auth.uid()` returns a row for the signed-in user.
- Sign-in lands on the correct role-based route instead of looping back to `/auth`.
- Spot-check `companies`, `people`, `invoices` queries from the client.
