-- Row Level Security baseline (US-A2). Every table gets RLS enabled here —
-- the CI check in scripts/check-rls-coverage.ts fails the build if a table
-- is added to schema.ts without a matching "ENABLE ROW LEVEL SECURITY" line
-- landing in a migration. Fine-grained owner-vs-manager action rules (the
-- full permission matrix) are US-A6 — this migration gives the coarse
-- "must belong to the org" / "must be the tenant" boundary that every other
-- policy builds on.
--
-- Ledger tables (journal_entries, journal_lines) intentionally get SELECT
-- policies only: writes happen exclusively through server actions using the
-- service-role client (src/lib/supabase/admin.ts), mirroring Zeno's
-- "posting.ts is the only writer" rule. No authenticated-role INSERT/UPDATE/
-- DELETE policy means those are denied by default.

-- ---------- Helper functions (SECURITY DEFINER to avoid RLS recursion) ----------

create or replace function app_current_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from org_members where user_id = auth.uid()
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
    where org_id = target_org and user_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function app_current_tenant_profile_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from tenant_profiles where user_id = auth.uid()
$$;

-- ---------- orgs ----------

alter table orgs enable row level security;

create policy orgs_select on orgs for select
  using (id in (select app_current_org_ids()));

create policy orgs_insert on orgs for insert
  with check (auth.uid() is not null);

create policy orgs_update on orgs for update
  using (app_is_org_owner(id));

-- ---------- org_members ----------

alter table org_members enable row level security;

create policy org_members_select on org_members for select
  using (org_id in (select app_current_org_ids()));

-- Bootstrap case: a brand-new org has zero members yet, so the signup flow
-- can seed its own owner row. After that, only an existing owner can add
-- members (the invite flow, US-A3, runs server-side with the admin client
-- anyway, but this keeps the policy correct if ever called client-side).
create policy org_members_insert on org_members for insert
  with check (
    user_id = auth.uid()
    and not exists (select 1 from org_members m where m.org_id = org_members.org_id)
    or app_is_org_owner(org_id)
  );

create policy org_members_delete on org_members for delete
  using (app_is_org_owner(org_id));

-- ---------- tenant_profiles ----------

alter table tenant_profiles enable row level security;

create policy tenant_profiles_select on tenant_profiles for select
  using (org_id in (select app_current_org_ids()) or user_id = auth.uid());

create policy tenant_profiles_write on tenant_profiles for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

-- ---------- properties / units ----------

alter table properties enable row level security;
create policy properties_all on properties for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

alter table units enable row level security;
create policy units_all on units for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

-- ---------- leases / lease_amendments ----------

alter table leases enable row level security;

create policy leases_select on leases for select
  using (
    org_id in (select app_current_org_ids())
    or tenant_profile_id in (select app_current_tenant_profile_ids())
  );

create policy leases_write on leases for insert with check (org_id in (select app_current_org_ids()));
create policy leases_update on leases for update using (org_id in (select app_current_org_ids()));
create policy leases_delete on leases for delete using (org_id in (select app_current_org_ids()));

alter table lease_amendments enable row level security;

create policy lease_amendments_select on lease_amendments for select
  using (
    org_id in (select app_current_org_ids())
    or lease_id in (
      select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
    )
  );

create policy lease_amendments_write on lease_amendments for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

-- ---------- invoices / invoice_lines ----------

alter table invoices enable row level security;

create policy invoices_select on invoices for select
  using (
    org_id in (select app_current_org_ids())
    or lease_id in (
      select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
    )
  );

create policy invoices_write on invoices for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

alter table invoice_lines enable row level security;

create policy invoice_lines_select on invoice_lines for select
  using (
    invoice_id in (
      select id from invoices
      where org_id in (select app_current_org_ids())
        or lease_id in (
          select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
        )
    )
  );

create policy invoice_lines_write on invoice_lines for all
  using (invoice_id in (select id from invoices where org_id in (select app_current_org_ids())))
  with check (invoice_id in (select id from invoices where org_id in (select app_current_org_ids())));

-- ---------- payments / payment_allocations ----------

alter table payments enable row level security;

create policy payments_select on payments for select
  using (
    org_id in (select app_current_org_ids())
    or lease_id in (
      select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
    )
  );

-- Payment writes happen via server actions (M-Pesa callbacks, manual entry
-- by staff) using the admin client — no client-side insert/update policy.

alter table payment_allocations enable row level security;

create policy payment_allocations_select on payment_allocations for select
  using (
    payment_id in (
      select id from payments
      where org_id in (select app_current_org_ids())
        or lease_id in (
          select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
        )
    )
  );

-- ---------- journal_entries / journal_lines (ledger — select-only, see header) ----------

alter table journal_entries enable row level security;
create policy journal_entries_select on journal_entries for select
  using (org_id in (select app_current_org_ids()));

alter table journal_lines enable row level security;
create policy journal_lines_select on journal_lines for select
  using (entry_id in (select id from journal_entries where org_id in (select app_current_org_ids())));

-- ---------- receipts ----------

alter table receipts enable row level security;
create policy receipts_select on receipts for select
  using (
    org_id in (select app_current_org_ids())
    or payment_id in (
      select id from payments where lease_id in (
        select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
      )
    )
  );

-- ---------- vendors / maintenance ----------

alter table vendors enable row level security;
create policy vendors_all on vendors for all
  using (org_id in (select app_current_org_ids()))
  with check (org_id in (select app_current_org_ids()));

alter table maintenance_tickets enable row level security;

create policy maintenance_tickets_select on maintenance_tickets for select
  using (
    org_id in (select app_current_org_ids())
    or lease_id in (
      select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
    )
  );

create policy maintenance_tickets_insert on maintenance_tickets for insert
  with check (
    org_id in (select app_current_org_ids())
    or lease_id in (
      select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
    )
  );

create policy maintenance_tickets_update on maintenance_tickets for update
  using (org_id in (select app_current_org_ids()));

alter table maintenance_attachments enable row level security;
create policy maintenance_attachments_select on maintenance_attachments for select
  using (
    ticket_id in (
      select id from maintenance_tickets
      where org_id in (select app_current_org_ids())
        or lease_id in (
          select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
        )
    )
  );
create policy maintenance_attachments_insert on maintenance_attachments for insert
  with check (
    ticket_id in (
      select id from maintenance_tickets
      where org_id in (select app_current_org_ids())
        or lease_id in (
          select id from leases where tenant_profile_id in (select app_current_tenant_profile_ids())
        )
    )
  );

-- ---------- platform/ops tables — org members select, sensitive writes server-only ----------

alter table webhook_events enable row level security;
create policy webhook_events_select on webhook_events for select
  using (org_id in (select app_current_org_ids()));

alter table mpesa_credentials_per_org enable row level security;
create policy mpesa_credentials_select on mpesa_credentials_per_org for select
  using (app_is_org_owner(org_id));
-- Insert/update restricted to owner; secrets are still application-layer
-- encrypted before they ever reach this table (US-C10).
create policy mpesa_credentials_write on mpesa_credentials_per_org for all
  using (app_is_org_owner(org_id))
  with check (app_is_org_owner(org_id));

alter table notification_log enable row level security;
create policy notification_log_select on notification_log for select
  using (
    org_id in (select app_current_org_ids())
    or tenant_profile_id in (select app_current_tenant_profile_ids())
  );

alter table audit_logs enable row level security;
create policy audit_logs_select on audit_logs for select
  using (app_is_org_owner(org_id));

alter table org_settings enable row level security;
create policy org_settings_select on org_settings for select
  using (org_id in (select app_current_org_ids()));
create policy org_settings_write on org_settings for all
  using (app_is_org_owner(org_id))
  with check (app_is_org_owner(org_id));
