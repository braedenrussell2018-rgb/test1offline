
-- Drop the trigger first, then the function with CASCADE
DROP TRIGGER IF EXISTS check_role_delete ON public.user_roles;
DROP TRIGGER IF EXISTS validate_role_delete_trigger ON public.user_roles;
DROP FUNCTION IF EXISTS validate_role_delete() CASCADE;

-- Now clean up all data from tables
DELETE FROM account_transactions;
DELETE FROM accounts;
DELETE FROM ai_conversations;
DELETE FROM audit_logs;
DELETE FROM budget_forecasts;
DELETE FROM companies;
DELETE FROM data_export_logs;
DELETE FROM expenses;
DELETE FROM invoices;
DELETE FROM items;
DELETE FROM login_attempts;
DELETE FROM people;
DELETE FROM profiles;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM quickbooks_connections;
DELETE FROM quickbooks_sync_log;
DELETE FROM quotes;
DELETE FROM spiff_prizes;
DELETE FROM spiff_program;
DELETE FROM user_ai_settings;
DELETE FROM user_roles;
DELETE FROM user_security_settings;
DELETE FROM vendors;
DELETE FROM branches;
