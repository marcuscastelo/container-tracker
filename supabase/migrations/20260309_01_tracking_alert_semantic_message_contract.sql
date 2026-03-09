-- 20260309_01_tracking_alert_semantic_message_contract
-- Structural migration only:
-- - Introduce canonical semantic message contract columns
-- - Remove legacy free-text message column
-- - No backfill is performed in this migration

alter table if exists public.tracking_alerts
add column if not exists message_key text;

alter table if exists public.tracking_alerts
add column if not exists message_params jsonb not null default '{}'::jsonb;

alter table if exists public.tracking_alerts
drop constraint if exists tracking_alerts_message_key_check;

alter table if exists public.tracking_alerts
add constraint tracking_alerts_message_key_check check (
  message_key in (
    'alerts.transshipmentDetected',
    'alerts.customsHoldDetected',
    'alerts.noMovementDetected',
    'alerts.etaMissing',
    'alerts.etaPassed',
    'alerts.portChange',
    'alerts.dataInconsistent'
  )
);

alter table if exists public.tracking_alerts
alter column message_key set not null;

alter table if exists public.tracking_alerts
drop column if exists message;
