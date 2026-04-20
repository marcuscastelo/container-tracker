-- 20260420_01_access_core_tables
-- Multi-tenant access core model (V1).

create extension if not exists pgcrypto;

create table if not exists public.platform_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_tenants_status_check'
      and conrelid = 'public.platform_tenants'::regclass
  ) then
    alter table public.platform_tenants
      add constraint platform_tenants_status_check
      check (status in ('ACTIVE', 'INACTIVE'));
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  workos_user_id text not null unique,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_role_definitions (
  id uuid primary key default gen_random_uuid(),
  platform_tenant_id uuid not null references public.platform_tenants(id) on delete cascade,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  permissions jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_tenant_id, code)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_role_definitions_code_check'
      and conrelid = 'public.tenant_role_definitions'::regclass
  ) then
    alter table public.tenant_role_definitions
      add constraint tenant_role_definitions_code_check
      check (code ~ '^[A-Z][A-Z0-9_]{1,63}$');
  end if;
end
$$;

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform_tenant_id uuid not null references public.platform_tenants(id) on delete cascade,
  role_code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform_tenant_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_memberships_status_check'
      and conrelid = 'public.tenant_memberships'::regclass
  ) then
    alter table public.tenant_memberships
      add constraint tenant_memberships_status_check
      check (status in ('ACTIVE', 'INACTIVE', 'SUSPENDED'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_memberships_role_definition_fkey'
      and conrelid = 'public.tenant_memberships'::regclass
  ) then
    alter table public.tenant_memberships
      add constraint tenant_memberships_role_definition_fkey
      foreign key (platform_tenant_id, role_code)
      references public.tenant_role_definitions(platform_tenant_id, code)
      on update cascade
      on delete restrict;
  end if;
end
$$;

create table if not exists public.importers (
  id uuid primary key default gen_random_uuid(),
  platform_tenant_id uuid not null references public.platform_tenants(id) on delete cascade,
  name text not null,
  tax_id text null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_tenant_id, name)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'importers_status_check'
      and conrelid = 'public.importers'::regclass
  ) then
    alter table public.importers
      add constraint importers_status_check
      check (status in ('ACTIVE', 'INACTIVE'));
  end if;
end
$$;

create table if not exists public.membership_importer_access (
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  importer_id uuid not null references public.importers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, importer_id)
);

create index if not exists idx_tenant_memberships_platform_tenant_status
  on public.tenant_memberships (platform_tenant_id, status, role_code);

create index if not exists idx_importers_platform_tenant
  on public.importers (platform_tenant_id, name);

create index if not exists idx_membership_importer_access_membership
  on public.membership_importer_access (membership_id, importer_id);

create or replace function public.set_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_platform_tenants_updated_at on public.platform_tenants;
create trigger trg_platform_tenants_updated_at
before update on public.platform_tenants
for each row
execute function public.set_access_updated_at();

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_access_updated_at();

drop trigger if exists trg_tenant_role_definitions_updated_at on public.tenant_role_definitions;
create trigger trg_tenant_role_definitions_updated_at
before update on public.tenant_role_definitions
for each row
execute function public.set_access_updated_at();

drop trigger if exists trg_tenant_memberships_updated_at on public.tenant_memberships;
create trigger trg_tenant_memberships_updated_at
before update on public.tenant_memberships
for each row
execute function public.set_access_updated_at();

drop trigger if exists trg_importers_updated_at on public.importers;
create trigger trg_importers_updated_at
before update on public.importers
for each row
execute function public.set_access_updated_at();

create or replace function public.enforce_membership_importer_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_membership_tenant uuid;
  v_importer_tenant uuid;
begin
  select platform_tenant_id
  into v_membership_tenant
  from public.tenant_memberships
  where id = new.membership_id;

  select platform_tenant_id
  into v_importer_tenant
  from public.importers
  where id = new.importer_id;

  if v_membership_tenant is null or v_importer_tenant is null then
    raise exception 'membership/importer not found';
  end if;

  if v_membership_tenant <> v_importer_tenant then
    raise exception 'membership_importer_access cross-tenant link is forbidden';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_membership_importer_same_tenant on public.membership_importer_access;
create trigger trg_membership_importer_same_tenant
before insert or update on public.membership_importer_access
for each row
execute function public.enforce_membership_importer_same_tenant();

insert into public.platform_tenants (id, slug, name, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'castro',
  'Castro',
  'ACTIVE'
)
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    status = excluded.status;

insert into public.platform_tenants (id, slug, name, status)
select distinct
  seed.tenant_id,
  'tenant-' || substring(replace(seed.tenant_id::text, '-', '') from 1 for 12),
  'Tenant ' || substring(seed.tenant_id::text from 1 for 8),
  'ACTIVE'
from (
  select tenant_id from public.sync_requests
  union all
  select tenant_id from public.tracking_agents
  union all
  select tenant_id from public.tracking_agent_activity_events
  union all
  select tenant_id from public.agent_install_tokens
  union all
  select tenant_id from public.agent_enrollment_audit_events
  union all
  select tenant_id from public.agent_control_commands
  union all
  select tenant_id from public.agent_log_events
) as seed
where seed.tenant_id is not null
on conflict (id) do nothing;

insert into public.tenant_role_definitions (platform_tenant_id, code, name, is_system, permissions)
select pt.id, 'ADMIN', 'Admin', true, null
from public.platform_tenants pt
on conflict (platform_tenant_id, code) do nothing;

insert into public.tenant_role_definitions (platform_tenant_id, code, name, is_system, permissions)
select pt.id, 'IMPORTER', 'Importer', true, null
from public.platform_tenants pt
on conflict (platform_tenant_id, code) do nothing;
