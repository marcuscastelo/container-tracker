-- 20260314_01_agent_logs_operational_runtime
-- Adds operational realtime log storage for agents with short retention.

alter table if exists public.tracking_agents
add column if not exists logs_supported boolean not null default false;

alter table if exists public.tracking_agents
add column if not exists last_log_at timestamptz null;

create table if not exists public.agent_log_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  agent_id uuid not null references public.tracking_agents(id) on delete cascade,
  sequence bigint not null,
  channel text not null,
  message text not null,
  occurred_at timestamptz not null default now(),
  truncated boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_log_events_channel_check'
      and conrelid = 'public.agent_log_events'::regclass
  ) then
    alter table public.agent_log_events
      add constraint agent_log_events_channel_check
      check (channel in ('stdout', 'stderr'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agent_log_events_sequence_non_negative_check'
      and conrelid = 'public.agent_log_events'::regclass
  ) then
    alter table public.agent_log_events
      add constraint agent_log_events_sequence_non_negative_check
      check (sequence >= 0);
  end if;
end
$$;

create unique index if not exists idx_agent_log_events_tenant_agent_sequence_unique
  on public.agent_log_events (tenant_id, agent_id, sequence);

create index if not exists idx_agent_log_events_tenant_agent_sequence_desc
  on public.agent_log_events (tenant_id, agent_id, sequence desc);

create index if not exists idx_agent_log_events_tenant_agent_channel_sequence_desc
  on public.agent_log_events (tenant_id, agent_id, channel, sequence desc);

create index if not exists idx_agent_log_events_created_at
  on public.agent_log_events (created_at);

create or replace function public.prune_agent_log_events()
returns integer
language plpgsql
as $function$
declare
  deleted_count integer;
begin
  delete from public.agent_log_events
  where created_at < now() - interval '7 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

do $do$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  if not exists (
    select 1
    from cron.job
    where jobname = 'prune-agent-log-events'
  ) then
    perform cron.schedule(
      'prune-agent-log-events',
      '45 3 * * *',
      $cron$select public.prune_agent_log_events();$cron$
    );
  end if;
end
$do$;
