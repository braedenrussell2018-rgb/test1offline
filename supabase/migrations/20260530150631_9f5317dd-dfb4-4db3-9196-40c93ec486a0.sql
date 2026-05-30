
-- Restore table grants on all public tables. RLS still enforces access.
-- No anon grants — every table is auth-only in this app.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_security_settings TO authenticated;
GRANT ALL ON public.user_security_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invites TO authenticated;
GRANT ALL ON public.tenant_invites TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_notifications TO authenticated;
GRANT ALL ON public.signup_notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_export_logs TO authenticated;
GRANT ALL ON public.data_export_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quickbooks_connections TO authenticated;
GRANT ALL ON public.quickbooks_connections TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quickbooks_sync_log TO authenticated;
GRANT ALL ON public.quickbooks_sync_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_forecasts TO authenticated;
GRANT ALL ON public.budget_forecasts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_invitees TO authenticated;
GRANT ALL ON public.calendar_event_invitees TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_meetings TO authenticated;
GRANT ALL ON public.company_meetings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_notes TO authenticated;
GRANT ALL ON public.internal_notes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_chat_messages TO authenticated;
GRANT ALL ON public.meeting_chat_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spiff_prizes TO authenticated;
GRANT ALL ON public.spiff_prizes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spiff_program TO authenticated;
GRANT ALL ON public.spiff_program TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spiff_warranties TO authenticated;
GRANT ALL ON public.spiff_warranties TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_settings TO authenticated;
GRANT ALL ON public.user_ai_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_meetings TO authenticated;
GRANT ALL ON public.video_meetings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_meeting_participants TO authenticated;
GRANT ALL ON public.video_meeting_participants TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

-- Restore EXECUTE on the helper functions that RLS policies depend on.
-- Without these, every policy check that calls has_role / is_tenant_member fails.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_developer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- RPCs intentionally callable by signed-in users
GRANT EXECUTE ON FUNCTION public.get_qb_tokens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_qb_connection_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_status(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.add_note_to_contact(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_person(uuid) TO authenticated;
