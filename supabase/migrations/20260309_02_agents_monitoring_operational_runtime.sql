-- 20260309_02_agents_monitoring_operational_runtime
-- Adds persisted operational monitoring state for enrolled agents and
-- append-only agent activity events used by /agents dashboards.

alter table if exists public.tracking_agents
add column if not exists enrolled_at timestamptz;

update public.tracking_agents
set enrolled_at = coalesce(enrolled_at, last_enrolled_at, created_at, now())
where enrolled_at is null;

alter table if exists public.tracking_agents
alter column enrolled_at set default now();

alter table if exists public.tracking_agents
alter column enrolled_at set not null;

alter table if exists public.tracking_agents
add column if not exists last_seen_at timestamptz null;

alter table if exists public.tracking_agents
add column if not exists status text not null default 'UNKNOWN';

alter table if exists public.tracking_agents
add column if not exists realtime_state text not null default 'UNKNOWN';

alter table if exists public.tracking_agents
add column if not exists processing_state text not null default 'unknown';

alter table if exists public.tracking_agents
add column if not exists lease_health text not null default 'unknown';

alter table if exists public.tracking_agents
add column if not exists active_jobs integer not null default 0;

alter table if exists public.tracking_agents
add column if not exists capabilities jsonb not null default '[]'::jsonb;

alter table if exists public.tracking_agents
add column if not exists enrollment_method text not null default 'unknown';

alter table if exists public.tracking_agents
add column if not exists token_id_masked text null;

alter table if exists public.tracking_agents
add column if not exists last_error text null;

alter table if exists public.tracking_agents
add column if not exists queue_lag_seconds integer null;

update public.tracking_agents
set last_seen_at = coalesce(last_seen_at, last_enrolled_at, created_at)
where last_seen_at is null;

update public.tracking_agents
set token_id_masked = case
  when char_length(agent_token) <= 8 then 'tok_' || agent_token
  else 'tok_' || left(agent_token, 4) || '...' || right(agent_token, 4)
end
where token_id_masked is null
  and agent_token is not null;

update public.tracking_agents
set capabilities = (
  jsonb_build_array('msc', 'cmacgm') ||
  case
    when maersk_enabled then jsonb_build_array('maersk')
    else '[]'::jsonb
  end
)
where capabilities = '[]'::jsonb;

update public.tracking_agents
set enrollment_method = 'bootstrap-token'
where enrollment_method = 'unknown'
  and last_enrolled_at is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_status_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_status_check
      check (status in ('CONNECTED', 'DEGRADED', 'DISCONNECTED', 'UNKNOWN'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_enrollment_method_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_enrollment_method_check
      check (enrollment_method in ('bootstrap-token', 'manual', 'unknown'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_realtime_state_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_realtime_state_check
      check (realtime_state in ('SUBSCRIBED', 'CHANNEL_ERROR', 'CONNECTING', 'DISCONNECTED', 'UNKNOWN'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_processing_state_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_processing_state_check
      check (processing_state in ('idle', 'leasing', 'processing', 'backing_off', 'unknown'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_lease_health_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_lease_health_check
      check (lease_health in ('healthy', 'stale', 'conflict', 'unknown'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_active_jobs_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_active_jobs_check
      check (active_jobs >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_queue_lag_seconds_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_queue_lag_seconds_check
      check (queue_lag_seconds is null or queue_lag_seconds >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_agents_capabilities_array_check'
      and conrelid = 'public.tracking_agents'::regclass
  ) then
    alter table public.tracking_agents
      add constraint tracking_agents_capabilities_array_check
      check (jsonb_typeof(capabilities) = 'array');
  end if;
end
$$;

create index if not exists idx_tracking_agents_tenant_last_seen
  on public.tracking_agents (tenant_id, last_seen_at desc);

create index if not exists idx_tracking_agents_tenant_status_last_seen
  on public.tracking_agents (tenant_id, status, last_seen_at desc);

create index if not exists idx_tracking_agents_tenant_updated
  on public.tracking_agents (tenant_id, updated_at desc);

create index if not exists idx_tracking_agents_capabilities_gin
  on public.tracking_agents using gin (capabilities jsonb_path_ops);

create index if not exists idx_sync_requests_tenant_leased_by_updated
  on public.sync_requests (tenant_id, leased_by, updated_at desc);

create table if not exists public.tracking_agent_activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  agent_id uuid not null references public.tracking_agents(id) on delete cascade,
  event_type text not null,
  message text not null,
  severity text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

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
          'LEASE_CONFLICT'
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
    where conname = 'tracking_agent_activity_events_severity_check'
      and conrelid = 'public.tracking_agent_activity_events'::regclass
  ) then
    alter table public.tracking_agent_activity_events
      add constraint tracking_agent_activity_events_severity_check
      check (severity in ('info', 'warning', 'danger', 'success'));
  end if;
end
$$;

create index if not exists idx_tracking_agent_activity_events_tenant_occurred
  on public.tracking_agent_activity_events (tenant_id, occurred_at desc);

create index if not exists idx_tracking_agent_activity_events_agent_occurred
  on public.tracking_agent_activity_events (agent_id, occurred_at desc);

create index if not exists idx_tracking_agent_activity_events_tenant_agent_occurred
  on public.tracking_agent_activity_events (tenant_id, agent_id, occurred_at desc);
