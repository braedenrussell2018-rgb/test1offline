# Multi-Tenant Refactor: Schema-Per-Company

## ⚠️ Important tradeoffs before you approve

You chose **separate Postgres schema per company**. This is the strongest isolation model but it has heavy ongoing costs that you should accept knowingly:

1. **Every future schema change** (add a column, new table, new RLS policy) must be replayed on **every tenant schema**. We'll automate this with a `clone_company_schema()` function + a "migrations registry," but it's still extra work forever.
2. **Supabase auto-generated `types.ts` only covers `public`.** Tenant schemas have to be exposed in `supabase/config.toml` under `[api] schemas` and types must be generated per schema, or all tenant queries must go through `supabase.schema('company_xxx').from(...)` with looser typing. We'll go with the `supabase.schema()` runtime approach.
3. **PostgREST exposes each schema individually.** Switching companies in the client means recreating the query builder with the active schema name. We'll centralize this in a `useTenantClient()` hook.
4. **Realtime, Storage, Edge Functions** still live in shared space — we have to scope them by `company_id` manually.
5. **Cross-company reporting** (for the global super-admin developer) requires a union view or per-schema loop.

If after reading this you'd prefer the simpler `company_id + RLS` model in `public`, say so and I'll rewrite the plan. Otherwise, here's the build.

---

## Architecture

```text
public schema (shared)
├── companies          (id, slug, name, schema_name, created_by, created_at)
├── company_members    (company_id, user_id, role, status: active|pending|invited)
├── company_invites    (company_id, email, token, role, expires_at)
├── tenant_migrations  (company_id, migration_name, applied_at)
└── user_roles         (kept for global 'developer' super-admin only)

company_<slug> schema (one per tenant, cloned from template)
├── people, companies (CRM), branches, items, invoices, quotes,
    purchase_orders, expenses, accounts, ai_conversations,
    calendar_events, internal_notes, geocode_cache, ... (every current public table except global ones)
```

Global tables that stay in `public` and are NOT cloned: `companies`, `company_members`, `company_invites`, `tenant_migrations`, `user_roles`, `profiles`, `audit_logs`, `login_attempts`, `user_security_settings`, `signup_notifications`, `quickbooks_connections`, `data_export_logs`, `meeting_*`, `video_*` (meetings are cross-org by design — confirm if you want these per-tenant too).

## Build steps

### 1. Tenant registry + helpers (migration)
- Create `public.companies`, `company_members`, `company_invites`, `tenant_migrations` with RLS:
  - User can read companies they're an active member of.
  - Developer (global role in `user_roles`) can read all.
- `current_company_id(uuid)` SECURITY DEFINER fn returns the active company for a user (from a `current_company_id` column on `profiles` + override by header).
- `is_company_member(company_id, user_id, roles[])` SECURITY DEFINER fn.
- `is_global_developer(uuid)` SECURITY DEFINER fn.

### 2. Template schema + cloning
- Create `template_tenant` schema containing the canonical structure of every per-tenant table (copied from current `public` definitions, minus the global ones above).
- Apply the **standard tenant RLS** to every table: SELECT/INSERT/UPDATE allowed if `is_company_member(<this_company_id>, auth.uid(), …)` or `is_global_developer(auth.uid())`. The schema name itself encodes the company, so we'll store `company_id` as a session GUC or rely on the schema-scoped policy (use `current_setting('app.current_company_id')` in policies).
- `public.clone_company_schema(company_id uuid, slug text)` SECURITY DEFINER fn: copies every table from `template_tenant` into `company_<slug>`, applies RLS, grants `authenticated` role usage, and registers in `tenant_migrations`.

### 3. Migrate existing data into company "TRUE"
- Insert one row into `public.companies` with `slug='true'`, `name='TRUE'`.
- Call `clone_company_schema()` → creates `company_true`.
- For each table in `template_tenant`: `INSERT INTO company_true.<table> SELECT * FROM public.<table>`.
- Insert every existing `user_roles` row as a `company_members` row under company TRUE with the same role.
- Set every existing profile's `current_company_id = <TRUE id>`.
- Drop the per-tenant tables from `public` only **after** verifying the migration succeeded (separate migration so it's reversible).

### 4. Signup flow rewrite (`src/pages/Auth.tsx`)
- Remove `owner`/`employee` from the public role selector (also fixes the open security finding).
- Replace single signup form with a two-step flow:
  1. Email/password + name.
  2. Choose: **Create a new company** (enter company name → becomes owner, schema cloned via edge function) OR **Join an existing company** (enter invite code → creates pending `company_members` row, owner approves in admin UI).
- Update `handle_new_user_role()` trigger so self-signup never grants `owner`/`employee`/`developer` globally.
- New edge function `provision-company` (auth-required) → calls `clone_company_schema()` and inserts the caller as owner member.
- New edge function `accept-invite` (auth-required) → validates token, creates pending member row.

### 5. Tenant-aware client (`src/lib/tenant-client.ts` + `useTenantClient()` hook)
- Reads `current_company_id` from profile on login → looks up `schema_name`.
- Exposes `db = supabase.schema(schemaName)` for all per-tenant queries.
- Every existing call like `supabase.from('people')` becomes `db.from('people')`. Big refactor surface (~60 files). We'll do it methodically by feature area.
- Add a top-bar **company switcher** for users belonging to multiple companies and for the global developer (lets developer pick any schema).

### 6. Edge function updates
- `prewarm-geocodes`, `bulk-import-contacts`, `expire-quotes`, `quickbooks-sync`, `generate-budget-forecast`, etc. all currently hit `public.*`. Each one will accept (or derive from JWT) the active `company_id`, resolve the schema, and query it. Also adds the missing auth check on `prewarm-geocodes` (open security finding).
- `admin-user-management` becomes per-company-scoped: owners only manage members of their own company; global developer can manage all.

### 7. Realtime + Storage scoping
- Realtime channels become `${schemaName}:${table}` and the subscription helper enforces the schema. (Doesn't fully fix the realtime-no-RLS finding for cross-company leak, but eliminates accidental cross-company subscriptions since the channel name is schema-scoped.)
- Storage buckets stay shared but file paths get a `<company_id>/...` prefix; storage policies updated to check `is_company_member` on the prefix.

### 8. UI: company management page
- `/company-settings` for owners: rename company, manage invites (generate code, revoke), approve pending members, change member roles, remove members.
- `/admin/tenants` for global developer: list all companies, switch into any, view per-company stats, lock/unlock companies.

### 9. QA + rollout
- Backup before migration (you should download a Supabase backup first).
- Run migration in a single transaction where possible; if it fails, nothing changes.
- Manual verification: log in as existing user → confirm all CRM data appears unchanged under "TRUE."
- Create a second test company → confirm it sees zero data from TRUE.
- Log in as global developer → confirm company switcher lists both.

## Files touched (approximate)

- New migrations: 3–5 large files
- New edge functions: `provision-company`, `accept-invite`; updates to ~10 existing functions
- New: `src/lib/tenant-client.ts`, `src/hooks/useTenantClient.ts`, `src/hooks/useCurrentCompany.ts`, `src/pages/CompanySettings.tsx`, `src/pages/TenantAdmin.tsx`, `src/components/CompanySwitcher.tsx`, `src/components/auth/CreateOrJoinCompany.tsx`
- Refactor: `src/pages/Auth.tsx`, plus ~50–70 files that currently do `supabase.from('<per-tenant table>')` — they need to switch to the tenant client. This is the bulk of the work.

## Out of scope (call out explicitly)

- Per-company billing / Stripe.
- Custom domains per company.
- Moving meetings/video tables into per-tenant schemas (left shared — confirm if you want them tenant-scoped).
- Fixing the unrelated security findings (salesman name spoof, account self-unlock, XSS in print, OAuth state, audit-log injection, route-proxy auth, meeting-recordings bucket). I'll flag these again after multi-tenancy lands.

## Scope of effort

This is a multi-day refactor with high risk. If you want to de-risk, I can split it into two passes: **(a)** ship the registry, signup flow, and the "TRUE" migration with everything still in `public` using `company_id` columns + RLS, then **(b)** move to per-schema isolation later. Say the word and I'll replan as the staged version.
