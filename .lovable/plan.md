# Multi-Tenant Refactor: `tenant_id` + RLS in `public`

You picked option 1. Same UX (companies, signup, "TRUE" migration, global developer super-admin), simpler isolation model that works with dynamic signup out of the box.

## Architecture

```text
public.companies            (id, slug, name, created_by, created_at)
public.company_members      (company_id, user_id, role, status)   -- per-company role
public.company_invites      (company_id, email, token, role, expires_at, used_at)

profiles.current_company_id  -- which company the user is "in" right now

every existing CRM table gets a NOT NULL company_id column
RLS on every table: company_id = current_company_id(auth.uid())
                    OR is_global_developer(auth.uid())
```

`user_roles` is kept only for the global `developer` super-admin. All `owner`/`employee`/`salesman`/`customer` roles move to `company_members.role` and are scoped to one company.

## Build steps

### 1. Registry migration
- `public.companies`, `company_members`, `company_invites`.
- Helpers (SECURITY DEFINER): `current_company_id(uuid)`, `is_company_member(company_id, user_id, roles[])`, `is_global_developer(uuid)`, `has_company_role(company_id, user_id, role)`.
- Add `current_company_id` column to `profiles`.

### 2. Add `company_id` to every CRM table + rewrite RLS
Tables touched: `people`, `companies` (CRM, renamed to `crm_companies` to avoid clash — or kept and the tenant table named `tenants`; I'll go with **`public.tenants` for tenants, keep `companies` as CRM**), `branches`, `items`, `invoices`, `quotes`, `purchase_orders`, `purchase_order_items`, `expenses`, `accounts`, `account_transactions`, `budget_forecasts`, `ai_conversations`, `calendar_events`, `calendar_event_invitees`, `internal_notes`, `geocode_cache`, `company_meetings`, `meeting_chat_messages`, `video_meetings`, `video_meeting_participants`, etc.
- Add `company_id uuid` (nullable initially, backfilled in step 3, then NOT NULL).
- Replace existing `has_role(...)` RLS policies with `is_company_member(company_id, auth.uid(), ARRAY[...]) OR is_global_developer(auth.uid())`.
- Salesman-scoped policies become per-tenant + salesman-name match.

### 3. "TRUE" backfill (data-only)
- Insert one `tenants` row: `slug='true'`, `name='TRUE'`.
- For every row in every CRM table: `UPDATE ... SET company_id = <TRUE>`.
- For every row in `user_roles`: insert `company_members(<TRUE>, user_id, role, 'active')`.
- Set every profile's `current_company_id = <TRUE>`.
- Then `ALTER ... SET NOT NULL` on `company_id`.

### 4. Signup flow (`src/pages/Auth.tsx`)
- Remove role selector from signup.
- Two-step: email/password/name → **Create company** (enter name → becomes `owner`, tenant row created) **OR Join existing** (paste invite code → pending member, owner approves).
- Rewrite `handle_new_user_role()` trigger so it does NOT auto-assign global `owner`/`employee`. Self-signup users get no global role; their role lives in `company_members` after they create or join a company.
- New edge function `provision-company` (creates tenant + owner member).
- New edge function `accept-invite` (validates token, creates pending member).

### 5. Active-company resolution
- `useAuth` reads `profiles.current_company_id` on login. If null and user has memberships, pick first.
- New `useCurrentCompany()` hook + `<CompanySwitcher />` in the top bar.
- Global developer's switcher lists ALL tenants (uses `is_global_developer`).
- All existing `has_role(...)` client checks → `useCompanyRole()` (reads `company_members` for current company; developer always passes).

### 6. Edge function updates
- All edge functions that write CRM data now read `company_id` from the caller's JWT/profile and stamp it on inserts.
- `prewarm-geocodes` gets the missing auth check.
- `admin-user-management` becomes per-company (invites, role changes) for owners; global for developer.

### 7. UI pages
- `/company-settings` (owner): rename tenant, manage invites, approve pending, change member roles.
- `/admin/tenants` (developer only): list/switch/lock tenants, see per-tenant stats.

### 8. QA
- After migration, log in as existing user → all data still visible under TRUE.
- Create a second tenant from a fresh signup → confirm zero TRUE data leaks.
- Log in as developer → switcher lists both, can switch between.

## Files

- 3 migrations: registry, add-company-id-and-rls, set-not-null.
- 2 new edge functions: `provision-company`, `accept-invite`.
- New: `src/hooks/useCurrentCompany.ts`, `src/components/CompanySwitcher.tsx`, `src/components/auth/CreateOrJoinCompany.tsx`, `src/pages/CompanySettings.tsx`, `src/pages/TenantAdmin.tsx`.
- Edits: `src/pages/Auth.tsx`, `src/hooks/useAuth.tsx`, `src/hooks/useUserRole.tsx`, ~20–30 components/pages that insert CRM rows (stamp `company_id` on insert).
- Updates to ~10 edge functions to scope by `company_id`.

## Out of scope

Per-company billing, custom domains, moving meetings/video into tenant scope (they'll still get a `company_id` + RLS, just like the rest), unrelated security findings.

## Risk / rollout

One reversible migration sequence. I'll run them in order; if the backfill fails, the NOT NULL step is held back so nothing breaks.
