-- 20260420_07_access_workos_identity_bigbang
-- Move RLS identity from users.id/auth.uid() to WorkOS subject (auth.jwt()->>'sub').

alter table public.tenant_memberships
  add column if not exists workos_user_id text;

update public.tenant_memberships tm
set workos_user_id = u.workos_user_id
from public.users u
where u.id = tm.user_id
  and tm.workos_user_id is null;

do $$
begin
  if exists (
    select 1
    from public.tenant_memberships
    where workos_user_id is null
  ) then
    raise exception 'tenant_memberships.workos_user_id backfill failed: null rows remain';
  end if;
end
$$;

alter table public.tenant_memberships
  alter column workos_user_id set not null;

create index if not exists idx_tenant_memberships_workos_user_tenant
  on public.tenant_memberships(workos_user_id, platform_tenant_id);

create table if not exists public.platform_superadmins (
  workos_user_id text primary key,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_superadmins_status_check'
      and conrelid = 'public.platform_superadmins'::regclass
  ) then
    alter table public.platform_superadmins
      add constraint platform_superadmins_status_check
      check (status in ('ACTIVE', 'INACTIVE'));
  end if;
end
$$;

alter table public.platform_superadmins enable row level security;

create or replace function private.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.platform_superadmins psa
    where psa.workos_user_id = auth.jwt()->>'sub'
      and psa.status = 'ACTIVE'
  );
$$;

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
    where tm.workos_user_id = auth.jwt()->>'sub'
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
    where tm.workos_user_id = auth.jwt()->>'sub'
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
    where tm.workos_user_id = auth.jwt()->>'sub'
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and tm.role_code = 'IMPORTER'
      and i.id = p_importer_id
      and i.platform_tenant_id = p_platform_tenant_id
  );
$$;

drop policy if exists tenant_memberships_select on public.tenant_memberships;
create policy tenant_memberships_select
on public.tenant_memberships
for select
to authenticated
using (
  private.is_tenant_admin(platform_tenant_id)
  or workos_user_id = auth.jwt()->>'sub'
);

drop policy if exists membership_importer_access_select on public.membership_importer_access;
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
        or tm.workos_user_id = auth.jwt()->>'sub'
      )
  )
);

drop policy if exists users_select on public.users;
drop policy if exists users_write on public.users;

create policy users_select
on public.users
for select
to authenticated
using (
  workos_user_id = auth.jwt()->>'sub'
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
using (workos_user_id = auth.jwt()->>'sub')
with check (workos_user_id = auth.jwt()->>'sub');
