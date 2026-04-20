-- 20260420_04_importer_scope
-- Add importer scope for IMPORTER-role authorization.

alter table if exists public.processes
add column if not exists importer_id uuid;

alter table if exists public.containers
add column if not exists importer_id uuid;

alter table if exists public.container_snapshots
add column if not exists importer_id uuid;

alter table if exists public.container_observations
add column if not exists importer_id uuid;

alter table if exists public.tracking_alerts
add column if not exists importer_id uuid;

insert into public.importers (platform_tenant_id, name, status)
select distinct
  p.platform_tenant_id,
  trim(p.importer_name),
  'ACTIVE'
from public.processes p
where p.platform_tenant_id is not null
  and p.importer_name is not null
  and trim(p.importer_name) <> ''
on conflict (platform_tenant_id, name) do nothing;

update public.processes p
set importer_id = i.id
from public.importers i
where p.importer_id is null
  and p.platform_tenant_id = i.platform_tenant_id
  and p.importer_name is not null
  and trim(p.importer_name) = i.name;

update public.containers c
set importer_id = p.importer_id
from public.processes p
where c.process_id = p.id
  and c.importer_id is null;

update public.container_snapshots s
set importer_id = c.importer_id
from public.containers c
where s.container_id = c.id
  and s.importer_id is null;

update public.container_observations o
set importer_id = c.importer_id
from public.containers c
where o.container_id = c.id
  and o.importer_id is null;

update public.tracking_alerts a
set importer_id = c.importer_id
from public.containers c
where a.container_id = c.id
  and a.importer_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'processes_importer_id_fkey'
      and conrelid = 'public.processes'::regclass
  ) then
    alter table public.processes
      add constraint processes_importer_id_fkey
      foreign key (importer_id)
      references public.importers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'containers_importer_id_fkey'
      and conrelid = 'public.containers'::regclass
  ) then
    alter table public.containers
      add constraint containers_importer_id_fkey
      foreign key (importer_id)
      references public.importers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'container_snapshots_importer_id_fkey'
      and conrelid = 'public.container_snapshots'::regclass
  ) then
    alter table public.container_snapshots
      add constraint container_snapshots_importer_id_fkey
      foreign key (importer_id)
      references public.importers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'container_observations_importer_id_fkey'
      and conrelid = 'public.container_observations'::regclass
  ) then
    alter table public.container_observations
      add constraint container_observations_importer_id_fkey
      foreign key (importer_id)
      references public.importers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_alerts_importer_id_fkey'
      and conrelid = 'public.tracking_alerts'::regclass
  ) then
    alter table public.tracking_alerts
      add constraint tracking_alerts_importer_id_fkey
      foreign key (importer_id)
      references public.importers(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_processes_importer_id
  on public.processes (platform_tenant_id, importer_id, created_at desc);

create index if not exists idx_containers_importer_id
  on public.containers (platform_tenant_id, importer_id, created_at desc);

create index if not exists idx_container_snapshots_importer_id
  on public.container_snapshots (platform_tenant_id, importer_id, fetched_at desc);

create index if not exists idx_container_observations_importer_id
  on public.container_observations (platform_tenant_id, importer_id, created_at desc);

create index if not exists idx_tracking_alerts_importer_id
  on public.tracking_alerts (platform_tenant_id, importer_id, triggered_at desc);

create or replace function public.enforce_process_importer_consistency()
returns trigger
language plpgsql
as $$
declare
  v_importer_tenant uuid;
begin
  if new.importer_id is null then
    return new;
  end if;

  select platform_tenant_id
  into v_importer_tenant
  from public.importers
  where id = new.importer_id;

  if v_importer_tenant is null then
    raise exception 'importer not found';
  end if;

  if new.platform_tenant_id is null then
    new.platform_tenant_id = v_importer_tenant;
  end if;

  if new.platform_tenant_id <> v_importer_tenant then
    raise exception 'process/importer tenant mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_processes_importer_consistency on public.processes;
create trigger trg_processes_importer_consistency
before insert or update on public.processes
for each row
execute function public.enforce_process_importer_consistency();

create or replace function public.fill_container_scope_from_process()
returns trigger
language plpgsql
as $$
declare
  v_platform_tenant_id uuid;
  v_importer_id uuid;
begin
  if new.process_id is null then
    return new;
  end if;

  select p.platform_tenant_id, p.importer_id
  into v_platform_tenant_id, v_importer_id
  from public.processes p
  where p.id = new.process_id;

  if new.platform_tenant_id is null then
    new.platform_tenant_id = v_platform_tenant_id;
  end if;

  if new.importer_id is null then
    new.importer_id = v_importer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_containers_fill_scope on public.containers;
create trigger trg_containers_fill_scope
before insert or update on public.containers
for each row
execute function public.fill_container_scope_from_process();

create or replace function public.fill_snapshot_scope_from_container()
returns trigger
language plpgsql
as $$
declare
  v_platform_tenant_id uuid;
  v_importer_id uuid;
begin
  if new.container_id is null then
    return new;
  end if;

  select c.platform_tenant_id, c.importer_id
  into v_platform_tenant_id, v_importer_id
  from public.containers c
  where c.id = new.container_id;

  if new.platform_tenant_id is null then
    new.platform_tenant_id = v_platform_tenant_id;
  end if;

  if new.importer_id is null then
    new.importer_id = v_importer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_container_snapshots_fill_scope on public.container_snapshots;
create trigger trg_container_snapshots_fill_scope
before insert or update on public.container_snapshots
for each row
execute function public.fill_snapshot_scope_from_container();

drop trigger if exists trg_container_observations_fill_scope on public.container_observations;
create trigger trg_container_observations_fill_scope
before insert or update on public.container_observations
for each row
execute function public.fill_snapshot_scope_from_container();

drop trigger if exists trg_tracking_alerts_fill_scope on public.tracking_alerts;
create trigger trg_tracking_alerts_fill_scope
before insert or update on public.tracking_alerts
for each row
execute function public.fill_snapshot_scope_from_container();
