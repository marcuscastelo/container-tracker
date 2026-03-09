-- 20260309_03_agents_update_runtime
-- Adds safe self-update runtime columns for tracking agents and extends
-- activity event taxonomy for update/rollback observability.

alter table if exists public.tracking_agents
add column if not exists current_version text;

alter table if exists public.tracking_agents
add column if not exists desired_version text null;

alter table if exists public.tracking_agents
add column if not exists update_channel text not null default 'stable';

alter table if exists public.tracking_agents
add column if not exists updater_state text not null default 'idle';

alter table if exists public.tracking_agents
add column if not exists updater_last_checked_at timestamptz null;

alter table if exists public.tracking_agents
add column if not exists updater_last_error text null;

alter table if exists public.tracking_agents
add column if not exists update_ready_version text null;

alter table if exists public.tracking_agents
add column if not exists restart_requested_at timestamptz null;

alter table if exists public.tracking_agents
add column if not exists boot_status text not null default 'unknown';

update public.tracking_agents
set current_version = coalesce(nullif(current_version, ''), agent_version, 'unknown')
where current_version is null or btrim(current_version) = '';

update public.tracking_agents
set desired_version = coalesce(desired_version, current_version)
where desired_version is null;

update public.tracking_agents
set update_channel = 'stable'
where update_channel is null or btrim(update_channel) = '';

update public.tracking_agents
set updater_state = 'idle'
where updater_state is null or btrim(updater_state) = '';

update public.tracking_agents
set boot_status = 'unknown'
where boot_status is null or btrim(boot_status) = '';

alter table if exists public.tracking_agents
alter column current_version set default 'unknown';

alter table if exists public.tracking_agents
alter column current_version set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_current_version_non_empty_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_current_version_non_empty_check
      check (btrim(current_version) <> '');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_update_channel_non_empty_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_update_channel_non_empty_check
      check (btrim(update_channel) <> '');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_updater_state_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_updater_state_check
      check (
        updater_state in (
          'idle',
          'checking',
          'downloading',
          'ready',
          'draining',
          'applying',
          'rollback',
          'blocked',
          'error',
          'unknown'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_boot_status_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_boot_status_check
      check (boot_status in ('starting', 'healthy', 'degraded', 'unknown'));
  end if;
end
$$;

alter table if exists public.tracking_agent_activity_events
drop constraint if exists tracking_agent_activity_events_event_type_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agent_activity_events_event_type_check'
      and conrelid = 'public.tracking_agent_activity_events'::regclass
  ) then
    alter table public.tracking_agent_activity_events
      add constraint tracking_agent_activity_events_event_type_check
      check (
        event_type in (
          'ENROLLED',
          'HEARTBEAT',
          'LEASED_TARGET',
          'SNAPSHOT_INGESTED',
          'REQUEST_FAILED',
          'REALTIME_SUBSCRIBED',
          'REALTIME_CHANNEL_ERROR',
          'LEASE_CONFLICT',
          'UPDATE_CHECKED',
          'UPDATE_AVAILABLE',
          'UPDATE_DOWNLOAD_STARTED',
          'UPDATE_DOWNLOAD_COMPLETED',
          'UPDATE_READY',
          'UPDATE_APPLY_STARTED',
          'UPDATE_APPLY_FAILED',
          'RESTART_FOR_UPDATE',
          'ROLLBACK_EXECUTED'
        )
      );
  end if;
end
$$;

create index if not exists idx_tracking_agents_tenant_desired_updated
  on public.tracking_agents (tenant_id, desired_version, updated_at desc);

create index if not exists idx_tracking_agents_tenant_restart_requested
  on public.tracking_agents (tenant_id, restart_requested_at desc);

