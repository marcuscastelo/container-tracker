-- 20260305_01_tracking_alerts_ack_only
-- Switch tracking alerts to a single acknowledgement state and optimize active lookups.

-- Preserve historical user action semantics during the big-bang migration:
-- if a row was previously dismissed and not acknowledged, treat it as acknowledged.
update public.tracking_alerts
set acked_at = coalesce(acked_at, dismissed_at)
where dismissed_at is not null;

alter table if exists public.tracking_alerts
drop column if exists dismissed_at;

create index if not exists tracking_alerts_active_idx
  on public.tracking_alerts (container_id)
  where acked_at is null;
