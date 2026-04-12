-- 20260310_01_tracking_alert_lifecycle_state
-- Introduce explicit lifecycle state for tracking alerts.

alter table if exists public.tracking_alerts
add column if not exists lifecycle_state text;

alter table if exists public.tracking_alerts
add column if not exists resolved_at timestamptz null;

alter table if exists public.tracking_alerts
add column if not exists resolved_reason text null;

update public.tracking_alerts
set lifecycle_state = case
  when acked_at is not null then 'ACKED'
  else 'ACTIVE'
end
where lifecycle_state is null;

alter table if exists public.tracking_alerts
alter column lifecycle_state set default 'ACTIVE';

alter table if exists public.tracking_alerts
alter column lifecycle_state set not null;

alter table if exists public.tracking_alerts
drop constraint if exists tracking_alerts_lifecycle_state_check;

alter table if exists public.tracking_alerts
add constraint tracking_alerts_lifecycle_state_check
check (lifecycle_state in ('ACTIVE', 'ACKED', 'AUTO_RESOLVED'));

alter table if exists public.tracking_alerts
drop constraint if exists tracking_alerts_resolved_reason_check;

alter table if exists public.tracking_alerts
add constraint tracking_alerts_resolved_reason_check
check (
  resolved_reason is null
  or resolved_reason in ('condition_cleared', 'terminal_state')
);

alter table if exists public.tracking_alerts
drop constraint if exists tracking_alerts_lifecycle_state_requires_timestamps_check;

alter table if exists public.tracking_alerts
add constraint tracking_alerts_lifecycle_state_requires_timestamps_check
check (
  (lifecycle_state <> 'ACKED' or acked_at is not null)
  and (lifecycle_state <> 'AUTO_RESOLVED' or resolved_at is not null)
);

drop index if exists tracking_alerts_active_idx;

create index if not exists tracking_alerts_active_idx
  on public.tracking_alerts (container_id)
  where lifecycle_state = 'ACTIVE';
