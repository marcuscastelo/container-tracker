-- 20260420_03_dual_column_compat
-- Keep tenant_id and platform_tenant_id compatible during transition.

create or replace function public.default_platform_tenant_id()
returns uuid
language sql
stable
as $$
  -- Migration-time fallback only; avoid environment-specific tenant slug coupling.
  select (
    select id
    from public.platform_tenants
    order by created_at asc, id asc
    limit 1
  );
$$;

alter table if exists public.processes
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.containers
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.container_snapshots
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.container_observations
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.tracking_alerts
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.sync_requests
alter column platform_tenant_id set default public.default_platform_tenant_id();

alter table if exists public.tracking_agents
alter column platform_tenant_id set default public.default_platform_tenant_id();

update public.processes
set platform_tenant_id = public.default_platform_tenant_id()
where platform_tenant_id is null;

update public.containers c
set platform_tenant_id = coalesce(
  (
    select p.platform_tenant_id
    from public.processes p
    where p.id = c.process_id
  ),
  public.default_platform_tenant_id()
)
where c.platform_tenant_id is null;

update public.container_snapshots s
set platform_tenant_id = coalesce(
  (
    select c.platform_tenant_id
    from public.containers c
    where c.id = s.container_id
  ),
  public.default_platform_tenant_id()
)
where s.platform_tenant_id is null;

update public.container_observations o
set platform_tenant_id = coalesce(
  (
    select c.platform_tenant_id
    from public.containers c
    where c.id = o.container_id
  ),
  public.default_platform_tenant_id()
)
where o.platform_tenant_id is null;

update public.tracking_alerts a
set platform_tenant_id = coalesce(
  (
    select c.platform_tenant_id
    from public.containers c
    where c.id = a.container_id
  ),
  public.default_platform_tenant_id()
)
where a.platform_tenant_id is null;

create or replace function public.sync_tenant_columns()
returns trigger
language plpgsql
as $$
begin
  if new.platform_tenant_id is null and new.tenant_id is not null then
    new.platform_tenant_id = new.tenant_id;
  end if;

  if new.tenant_id is null and new.platform_tenant_id is not null then
    new.tenant_id = new.platform_tenant_id;
  end if;

  if new.platform_tenant_id is not null
     and new.tenant_id is not null
     and new.platform_tenant_id <> new.tenant_id then
    raise exception 'tenant_id and platform_tenant_id must match';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_requests_sync_tenant_columns on public.sync_requests;
create trigger trg_sync_requests_sync_tenant_columns
before insert or update on public.sync_requests
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_tracking_agents_sync_tenant_columns on public.tracking_agents;
create trigger trg_tracking_agents_sync_tenant_columns
before insert or update on public.tracking_agents
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_tracking_agent_activity_events_sync_tenant_columns on public.tracking_agent_activity_events;
create trigger trg_tracking_agent_activity_events_sync_tenant_columns
before insert or update on public.tracking_agent_activity_events
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_agent_install_tokens_sync_tenant_columns on public.agent_install_tokens;
create trigger trg_agent_install_tokens_sync_tenant_columns
before insert or update on public.agent_install_tokens
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_agent_enrollment_audit_events_sync_tenant_columns on public.agent_enrollment_audit_events;
create trigger trg_agent_enrollment_audit_events_sync_tenant_columns
before insert or update on public.agent_enrollment_audit_events
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_agent_control_commands_sync_tenant_columns on public.agent_control_commands;
create trigger trg_agent_control_commands_sync_tenant_columns
before insert or update on public.agent_control_commands
for each row
execute function public.sync_tenant_columns();

drop trigger if exists trg_agent_log_events_sync_tenant_columns on public.agent_log_events;
create trigger trg_agent_log_events_sync_tenant_columns
before insert or update on public.agent_log_events
for each row
execute function public.sync_tenant_columns();

update public.sync_requests
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.tracking_agents
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.tracking_agent_activity_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_install_tokens
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_enrollment_audit_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_control_commands
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_log_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sync_requests_tenant_columns_match_check'
      and conrelid = 'public.sync_requests'::regclass
  ) then
    alter table public.sync_requests
      add constraint sync_requests_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_tenant_columns_match_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agent_activity_events_tenant_columns_match_check'
      and conrelid = 'public.tracking_agent_activity_events'::regclass
  ) then
    alter table public.tracking_agent_activity_events
      add constraint tracking_agent_activity_events_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_install_tokens_tenant_columns_match_check'
      and conrelid = 'public.agent_install_tokens'::regclass
  ) then
    alter table public.agent_install_tokens
      add constraint agent_install_tokens_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_enrollment_audit_events_tenant_columns_match_check'
      and conrelid = 'public.agent_enrollment_audit_events'::regclass
  ) then
    alter table public.agent_enrollment_audit_events
      add constraint agent_enrollment_audit_events_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_control_commands_tenant_columns_match_check'
      and conrelid = 'public.agent_control_commands'::regclass
  ) then
    alter table public.agent_control_commands
      add constraint agent_control_commands_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_log_events_tenant_columns_match_check'
      and conrelid = 'public.agent_log_events'::regclass
  ) then
    alter table public.agent_log_events
      add constraint agent_log_events_tenant_columns_match_check
      check (tenant_id = platform_tenant_id);
  end if;
end
$$;

alter table if exists public.processes
alter column platform_tenant_id set not null;

alter table if exists public.containers
alter column platform_tenant_id set not null;

alter table if exists public.container_snapshots
alter column platform_tenant_id set not null;

alter table if exists public.container_observations
alter column platform_tenant_id set not null;

alter table if exists public.tracking_alerts
alter column platform_tenant_id set not null;

alter table if exists public.sync_requests
alter column platform_tenant_id set not null;

alter table if exists public.tracking_agents
alter column platform_tenant_id set not null;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'processes',
      'containers',
      'container_snapshots',
      'container_observations',
      'tracking_alerts',
      'sync_requests',
      'tracking_agents',
      'tracking_agent_activity_events',
      'agent_install_tokens',
      'agent_enrollment_audit_events',
      'agent_control_commands',
      'agent_log_events'
    ])
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = t || '_platform_tenant_id_fkey'
        and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (platform_tenant_id) references public.platform_tenants(id) on delete restrict',
        t,
        t || '_platform_tenant_id_fkey'
      );
    end if;
  end loop;
end
$$;
