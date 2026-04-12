-- 20260310_04_provider_paced_sync_scheduler_cron
-- Activates provider-paced sync scheduler cron job.

do $do$
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception 'pg_cron extension is required for provider-paced sync scheduler cron migration';
  end if;

  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is installed but cron.job is unavailable';
  end if;
end
$do$;

do $do$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'daily-container-sync'
  order by jobid desc
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$do$;

do $do$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'provider-paced-container-sync'
  ) then
    perform cron.schedule(
      'provider-paced-container-sync',
      '*/5 * * * *',
      $cron$select public.enqueue_container_sync_batch();$cron$
    );
  end if;
end
$do$;
