-- 20260404_01_agent_control_ui_v1
-- Remote control policy and append-only command queue for local agent control.

alter table if exists public.tracking_agents
add column if not exists remote_updates_paused boolean not null default false;

alter table if exists public.tracking_agents
add column if not exists remote_blocked_versions text[] not null default '{}';

update public.tracking_agents
set remote_updates_paused = false
where remote_updates_paused is null;

update public.tracking_agents
set remote_blocked_versions = '{}'
where remote_blocked_versions is null;

create table if not exists public.agent_control_commands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  agent_id uuid not null references public.tracking_agents(id) on delete cascade,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  requested_by text null,
  acknowledged_at timestamptz null,
  acknowledged_status text null,
  acknowledgement_detail text null,
  acknowledged_by text null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_control_commands_command_type_check'
      and conrelid = 'public.agent_control_commands'::regclass
  ) then
    alter table public.agent_control_commands
      add constraint agent_control_commands_command_type_check
      check (command_type in ('RESET_AGENT', 'RESTART_AGENT'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_control_commands_acknowledged_status_check'
      and conrelid = 'public.agent_control_commands'::regclass
  ) then
    alter table public.agent_control_commands
      add constraint agent_control_commands_acknowledged_status_check
      check (
        acknowledged_status is null
        or acknowledged_status in ('APPLIED', 'IGNORED', 'FAILED')
      );
  end if;
end
$$;

create index if not exists idx_agent_control_commands_pending
  on public.agent_control_commands (tenant_id, agent_id, acknowledged_at, requested_at desc);

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
          'ROLLBACK_EXECUTED',
          'LOCAL_UPDATE_PAUSED',
          'LOCAL_UPDATE_RESUMED',
          'CHANNEL_CHANGED',
          'CONFIG_UPDATED',
          'RELEASE_ACTIVATED',
          'LOCAL_RESET',
          'REMOTE_RESET',
          'REMOTE_FORCE_UPDATE'
        )
      );
  end if;
end
$$;
