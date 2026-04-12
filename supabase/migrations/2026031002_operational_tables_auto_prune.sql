-- 20260310_02_operational_tables_auto_prune
-- Adds database-level auto-pruning for operational tables.

do $do$
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception 'pg_cron extension is required for operational auto-pruning migration';
  end if;

  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is installed but cron.job is unavailable';
  end if;
end
$do$;

create or replace function public.prune_tracking_agent_activity_events()
returns integer
language plpgsql
as $function$
declare
  deleted_count integer;
begin
  delete from public.tracking_agent_activity_events
  where created_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

create or replace function public.prune_sync_requests()
returns integer
language plpgsql
as $function$
declare
  deleted_count integer;
begin
  delete from public.sync_requests
  where status in ('DONE', 'FAILED')
    and created_at < now() - interval '14 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

create index if not exists idx_tracking_agent_activity_events_created_at
  on public.tracking_agent_activity_events (created_at);

create index if not exists idx_sync_requests_terminal_created_at
  on public.sync_requests (created_at)
  where status in ('DONE', 'FAILED');

do $do$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'prune-tracking-agent-activity-events'
  ) then
    perform cron.schedule(
      'prune-tracking-agent-activity-events',
      '15 3 * * *',
      $cron$select public.prune_tracking_agent_activity_events();$cron$
    );
  end if;
end
$do$;

do $do$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'prune-sync-requests'
  ) then
    perform cron.schedule(
      'prune-sync-requests',
      '30 3 * * *',
      $cron$select public.prune_sync_requests();$cron$
    );
  end if;
end
$do$;
