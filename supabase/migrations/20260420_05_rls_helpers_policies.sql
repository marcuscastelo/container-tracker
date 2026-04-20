-- 20260420_05_rls_helpers_policies
-- RLS helpers and policies for multi-tenant authorization.

create schema if not exists private;

create or replace function private.has_active_membership(p_platform_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
  );
$$;

create or replace function private.is_tenant_admin(p_platform_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and tm.role_code = 'ADMIN'
  );
$$;

create or replace function private.has_importer_access(
  p_platform_tenant_id uuid,
  p_importer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.membership_importer_access mia
      on mia.membership_id = tm.id
    join public.importers i
      on i.id = mia.importer_id
    where tm.user_id = auth.uid()
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and tm.role_code = 'IMPORTER'
      and i.id = p_importer_id
      and i.platform_tenant_id = p_platform_tenant_id
  );
$$;

create or replace function private.can_access_row(
  p_platform_tenant_id uuid,
  p_importer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (
    private.is_tenant_admin(p_platform_tenant_id)
    or (
      p_importer_id is not null
      and private.has_importer_access(p_platform_tenant_id, p_importer_id)
    )
  );
$$;

alter table if exists public.processes enable row level security;
alter table if exists public.containers enable row level security;
alter table if exists public.container_snapshots enable row level security;
alter table if exists public.container_observations enable row level security;
alter table if exists public.tracking_alerts enable row level security;
alter table if exists public.sync_requests enable row level security;
alter table if exists public.tracking_agents enable row level security;
alter table if exists public.importers enable row level security;
alter table if exists public.tenant_memberships enable row level security;
alter table if exists public.membership_importer_access enable row level security;
alter table if exists public.tenant_role_definitions enable row level security;
alter table if exists public.platform_tenants enable row level security;
alter table if exists public.users enable row level security;

drop policy if exists processes_select on public.processes;
drop policy if exists processes_insert on public.processes;
drop policy if exists processes_update on public.processes;
drop policy if exists processes_delete on public.processes;

create policy processes_select
on public.processes
for select
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

create policy processes_insert
on public.processes
for insert
to authenticated
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy processes_update
on public.processes
for update
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id))
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy processes_delete
on public.processes
for delete
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

drop policy if exists containers_select on public.containers;
drop policy if exists containers_insert on public.containers;
drop policy if exists containers_update on public.containers;
drop policy if exists containers_delete on public.containers;

create policy containers_select
on public.containers
for select
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

create policy containers_insert
on public.containers
for insert
to authenticated
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy containers_update
on public.containers
for update
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id))
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy containers_delete
on public.containers
for delete
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

drop policy if exists container_snapshots_select on public.container_snapshots;
drop policy if exists container_snapshots_insert on public.container_snapshots;
drop policy if exists container_snapshots_update on public.container_snapshots;
drop policy if exists container_snapshots_delete on public.container_snapshots;

create policy container_snapshots_select
on public.container_snapshots
for select
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

create policy container_snapshots_insert
on public.container_snapshots
for insert
to authenticated
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy container_snapshots_update
on public.container_snapshots
for update
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id))
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy container_snapshots_delete
on public.container_snapshots
for delete
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

drop policy if exists container_observations_select on public.container_observations;
drop policy if exists container_observations_insert on public.container_observations;
drop policy if exists container_observations_update on public.container_observations;
drop policy if exists container_observations_delete on public.container_observations;

create policy container_observations_select
on public.container_observations
for select
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

create policy container_observations_insert
on public.container_observations
for insert
to authenticated
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy container_observations_update
on public.container_observations
for update
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id))
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy container_observations_delete
on public.container_observations
for delete
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

drop policy if exists tracking_alerts_select on public.tracking_alerts;
drop policy if exists tracking_alerts_insert on public.tracking_alerts;
drop policy if exists tracking_alerts_update on public.tracking_alerts;
drop policy if exists tracking_alerts_delete on public.tracking_alerts;

create policy tracking_alerts_select
on public.tracking_alerts
for select
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

create policy tracking_alerts_insert
on public.tracking_alerts
for insert
to authenticated
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy tracking_alerts_update
on public.tracking_alerts
for update
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id))
with check (private.can_access_row(platform_tenant_id, importer_id));

create policy tracking_alerts_delete
on public.tracking_alerts
for delete
to authenticated
using (private.can_access_row(platform_tenant_id, importer_id));

drop policy if exists sync_requests_select on public.sync_requests;
drop policy if exists sync_requests_insert on public.sync_requests;
drop policy if exists sync_requests_update on public.sync_requests;
drop policy if exists sync_requests_delete on public.sync_requests;

create policy sync_requests_select
on public.sync_requests
for select
to authenticated
using (private.is_tenant_admin(platform_tenant_id));

create policy sync_requests_insert
on public.sync_requests
for insert
to authenticated
with check (private.is_tenant_admin(platform_tenant_id));

create policy sync_requests_update
on public.sync_requests
for update
to authenticated
using (private.is_tenant_admin(platform_tenant_id))
with check (private.is_tenant_admin(platform_tenant_id));

create policy sync_requests_delete
on public.sync_requests
for delete
to authenticated
using (private.is_tenant_admin(platform_tenant_id));

drop policy if exists tracking_agents_select on public.tracking_agents;
drop policy if exists tracking_agents_insert on public.tracking_agents;
drop policy if exists tracking_agents_update on public.tracking_agents;
drop policy if exists tracking_agents_delete on public.tracking_agents;

create policy tracking_agents_select
on public.tracking_agents
for select
to authenticated
using (private.is_tenant_admin(platform_tenant_id));

create policy tracking_agents_insert
on public.tracking_agents
for insert
to authenticated
with check (private.is_tenant_admin(platform_tenant_id));

create policy tracking_agents_update
on public.tracking_agents
for update
to authenticated
using (private.is_tenant_admin(platform_tenant_id))
with check (private.is_tenant_admin(platform_tenant_id));

create policy tracking_agents_delete
on public.tracking_agents
for delete
to authenticated
using (private.is_tenant_admin(platform_tenant_id));

drop policy if exists importers_select on public.importers;
drop policy if exists importers_write on public.importers;

create policy importers_select
on public.importers
for select
to authenticated
using (private.can_access_row(platform_tenant_id, id));

create policy importers_write
on public.importers
for all
to authenticated
using (private.is_tenant_admin(platform_tenant_id))
with check (private.is_tenant_admin(platform_tenant_id));

drop policy if exists tenant_role_definitions_select on public.tenant_role_definitions;
drop policy if exists tenant_role_definitions_write on public.tenant_role_definitions;

create policy tenant_role_definitions_select
on public.tenant_role_definitions
for select
to authenticated
using (private.has_active_membership(platform_tenant_id));

create policy tenant_role_definitions_write
on public.tenant_role_definitions
for all
to authenticated
using (private.is_tenant_admin(platform_tenant_id))
with check (private.is_tenant_admin(platform_tenant_id));

drop policy if exists tenant_memberships_select on public.tenant_memberships;
drop policy if exists tenant_memberships_write on public.tenant_memberships;

create policy tenant_memberships_select
on public.tenant_memberships
for select
to authenticated
using (
  private.is_tenant_admin(platform_tenant_id)
  or user_id = auth.uid()
);

create policy tenant_memberships_write
on public.tenant_memberships
for all
to authenticated
using (private.is_tenant_admin(platform_tenant_id))
with check (private.is_tenant_admin(platform_tenant_id));

drop policy if exists membership_importer_access_select on public.membership_importer_access;
drop policy if exists membership_importer_access_write on public.membership_importer_access;

create policy membership_importer_access_select
on public.membership_importer_access
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.id = membership_importer_access.membership_id
      and (
        private.is_tenant_admin(tm.platform_tenant_id)
        or tm.user_id = auth.uid()
      )
  )
);

create policy membership_importer_access_write
on public.membership_importer_access
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    join public.importers i
      on i.id = membership_importer_access.importer_id
    where tm.id = membership_importer_access.membership_id
      and private.is_tenant_admin(tm.platform_tenant_id)
      and i.platform_tenant_id = tm.platform_tenant_id
  )
)
with check (
  exists (
    select 1
    from public.tenant_memberships tm
    join public.importers i
      on i.id = membership_importer_access.importer_id
    where tm.id = membership_importer_access.membership_id
      and private.is_tenant_admin(tm.platform_tenant_id)
      and i.platform_tenant_id = tm.platform_tenant_id
  )
);

drop policy if exists platform_tenants_select on public.platform_tenants;
create policy platform_tenants_select
on public.platform_tenants
for select
to authenticated
using (private.has_active_membership(id));

drop policy if exists users_select on public.users;
drop policy if exists users_write on public.users;

create policy users_select
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = users.id
      and private.is_tenant_admin(tm.platform_tenant_id)
  )
);

create policy users_write
on public.users
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
