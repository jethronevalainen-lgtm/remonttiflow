# VaKantti — Supabase Database Migrations

Database layer for the VaKantti (formerly RemonttiFlow) construction
management app. Supabase project: **`remonttiflow`** (Postgres 17).

> These files are **authored only** in the repo. They are applied to the
> hosted project manually (after confirmation) — nothing here runs
> automatically on commit.

---

## Files

| File | Purpose |
|---|---|
| `migrations/20260723064035_create_tables` | *(already applied)* 6 empty business tables: `projects`, `work_orders`, `time_entries`, `employees`, `customers`, `equipment`. RLS enabled, **no policies**. |
| `migrations/20260723210000_multitenancy_core.sql` | New tenant tables (`organizations`, `profiles`, `organization_members`, `project_members`, `audit_logs`) + nullable `organization_id` / `created_by` / FK columns on the 6 business tables. |
| `migrations/20260723211000_functions_and_triggers.sql` | `set_updated_at()` + triggers, `handle_new_user()` trigger on `auth.users`, SECURITY DEFINER RLS helpers `is_org_member()` / `has_org_role()`. |
| `migrations/20260723212000_rls_policies.sql` | Full RLS policy set for all 11 tables. |
| `seed.sql` | DEV seed: one demo organization + commented-out templates for memberships and demo rows. |

Apply order is the timestamp order above. `20260723210000` assumes
`20260723064035_create_tables` is already applied (it is, on the hosted
project).

---

## How migrations are applied

### Option A — Supabase MCP (current workflow)

The orchestrator applies each migration file to project `remonttiflow`
with the Supabase MCP `apply_migration` tool, **after user confirmation**,
in timestamp order:

1. `20260723210000_multitenancy_core.sql`
2. `20260723211000_functions_and_triggers.sql`
3. `20260723212000_rls_policies.sql`
4. Optionally run `seed.sql` via `execute_sql` (dev only).

### Option B — Supabase CLI

```bash
supabase link --project-ref <remonttiflow-project-ref>
supabase db push          # applies everything under supabase/migrations/
# dev reset (drops + reapplies migrations + runs seed.sql):
supabase db reset
```

### Verifying after apply

```sql
-- policies exist?
select schemaname, tablename, policyname from pg_policies
 where schemaname = 'public' order by tablename, policyname;

-- RLS enabled everywhere?
select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r';

-- triggers?
select tgname, tgrelid::regclass from pg_trigger where not tgisinternal;
```

---

## Multitenancy model

```
 auth.users (Supabase Auth)
      │ 1
      │        handle_new_user trigger copies
      ▼        full_name/avatar_url from raw_user_meta_data
   profiles ────────────────────────────────┐
      │ n                                   │ n
      │            organization_members     │
      │        ┌─────────────────────────┐  │
      └────────┤ organization_id  (FK)   ├──┘
               │ user_id          (FK)   │
               │ role: admin |           │
               │       supervisor |      │
               │       worker            │
               └───────────┬─────────────┘
                           │ n
                           ▼
                     organizations  ◄── tenant root (1 org per customer company)
                           │ 1
        ┌──────────────────┼─────────────────────────────────────┐
        │ organization_id (FK, nullable during transition)        │
        ▼                  ▼                  ▼                   ▼
    projects          work_orders        time_entries   employees / customers / equipment
        │ 1                  │ n                │ n
        │                    │ project_id       │ project_id / employee_id
        ▼                    ▼                  ▼
   project_members ────► projects (n:1, per-user assignment)
        │
        └── user_id ──► profiles

   audit_logs ── organization_id, user_id, action, table_name, record_id, metadata
                 (append-only: INSERT any member, SELECT admin/supervisor)
```

**Roles** (per organization, in `organization_members.role`):

| Role | Can do |
|---|---|
| `admin` | Everything in the org + manage members + update organization |
| `supervisor` | Read/write/delete all business data in the org; read audit logs |
| `worker` | Read business data in the org; insert rows; update **own** `time_entries` while `status = 'Odottaa'` |

**RLS enforcement** — every business row carries `organization_id`. Policies
call `is_org_member(org)` / `has_org_role(org, roles)` — SECURITY DEFINER
helpers that read `organization_members` bypassing RLS, avoiding recursive
policy evaluation. Rows with `organization_id IS NULL` are invisible to all
non-service-role users (defense during the gradual frontend migration).

**Bootstrap caveat** — `organization_members` has admin-only INSERT, so the
first admin of an org cannot self-create through the client API. Org
bootstrap happens via `seed.sql` (dev), the service role, or a future
invite/provisioning flow (Edge Function). This is intentional.

**Legacy columns** — the original text columns (`projects.customer`,
`work_orders.project` / `.assignee`, `time_entries.project` / `.employee`)
are kept alongside the new uuid FKs (`customer_id`, `project_id`,
`employee_id`). The frontend migrates gradually; a later migration will
backfill, enforce `organization_id NOT NULL`, and eventually drop the text
columns.

---

## Rollback strategy (per migration)

Rollback is **manual** (SQL editor or a compensating migration). Apply in
reverse order. Because all business tables are currently empty, the column
drops below are safe today; re-check row counts before rolling back once
real data exists.

### Roll back `20260723212000_rls_policies.sql`

Drop every policy by name (see the file header for the full list), e.g.:

```sql
drop policy if exists projects_select on public.projects;
-- ... repeat for all policies created in the file
-- optionally, for the 5 NEW tables only:
alter table public.organizations        disable row level security;
alter table public.profiles             disable row level security;
alter table public.organization_members disable row level security;
alter table public.project_members      disable row level security;
alter table public.audit_logs           disable row level security;
```

Do **not** disable RLS on the 6 original tables — that state belongs to
`20260723064035_create_tables`.

### Roll back `20260723211000_functions_and_triggers.sql`

```sql
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists set_organizations_updated_at on public.organizations;
drop trigger if exists set_profiles_updated_at      on public.profiles;
drop trigger if exists set_projects_updated_at      on public.projects;
drop trigger if exists set_work_orders_updated_at   on public.work_orders;
drop trigger if exists set_time_entries_updated_at  on public.time_entries;
drop function if exists public.has_org_role(uuid, text[]);
drop function if exists public.is_org_member(uuid);
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
```

RLS policies depend on `is_org_member` / `has_org_role` — roll back the
policies **first**.

### Roll back `20260723210000_multitenancy_core.sql`

Drop the added columns from the 6 business tables, then drop the 5 new
tables in dependency order (`audit_logs`, `project_members`,
`organization_members`, `profiles`, `organizations`). The exact statements
are in the migration file header.

### Roll back `seed.sql`

```sql
delete from public.organizations
 where id = '00000000-0000-4000-8000-000000000001';
```

---

## Conventions in these files

- **Idempotent where reasonable**: `create table if not exists`,
  `add column if not exists`, `create or replace function`,
  `drop trigger if exists` / `drop policy if exists` before re-creating.
- **Timestamps** are `timestamptz`, defaulting to `now()`.
- **Finnish enum values** in CHECK constraints (statuses, priorities) are
  unchanged from `20260723064035_create_tables` — they match the domain
  types in `src/types/index.ts`.
- Policy naming: `<table>_<action>` (e.g. `projects_select`,
  `time_entries_update`).
