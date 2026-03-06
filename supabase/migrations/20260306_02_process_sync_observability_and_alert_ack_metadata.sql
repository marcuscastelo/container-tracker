-- 20260306_02_process_sync_observability_and_alert_ack_metadata
-- Add nullable alert acknowledge metadata and polling-oriented indexes.

alter table if exists public.tracking_alerts
add column if not exists acked_by text null;

alter table if exists public.tracking_alerts
add column if not exists acked_source text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tracking_alerts_acked_source_check'
      and conrelid = 'public.tracking_alerts'::regclass
  ) then
    alter table public.tracking_alerts
      add constraint tracking_alerts_acked_source_check
      check (
        acked_source is null
        or acked_source in ('dashboard', 'process_view', 'api')
      );
  end if;
end
$$;

create index if not exists idx_sync_requests_tenant_ref_updated_at
  on public.sync_requests (tenant_id, ref_type, ref_value, updated_at desc);

create index if not exists idx_containers_process_number
  on public.containers (process_id, container_number);
