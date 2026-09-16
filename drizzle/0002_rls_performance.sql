-- RLS performance fix (supabase-postgres-best-practices skill,
-- security-rls-performance.md): wrap auth.uid() in a SELECT so Postgres
-- caches it once per query instead of re-evaluating per row. Epic C adds
-- heavy invoice/payment/ledger query volume, so this lands before that
-- traffic shows up rather than after a slow-query report.

create or replace function app_current_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from org_members where user_id = (select auth.uid())
$$;

create or replace function app_is_org_owner(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

create or replace function app_current_tenant_profile_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from tenant_profiles where user_id = (select auth.uid())
$$;
