-- 20260411_01_tracking_alert_planned_transshipment_message_key
-- Include planned transshipment monitoring alerts in the semantic message contract.

alter table if exists public.tracking_alerts
drop constraint if exists tracking_alerts_message_key_check;

alter table if exists public.tracking_alerts
add constraint tracking_alerts_message_key_check check (
  message_key = any (
    array[
      'alerts.transshipmentDetected'::text,
      'alerts.plannedTransshipmentDetected'::text,
      'alerts.customsHoldDetected'::text,
      'alerts.noMovementDetected'::text,
      'alerts.etaMissing'::text,
      'alerts.etaPassed'::text,
      'alerts.portChange'::text,
      'alerts.dataInconsistent'::text
    ]
  )
);
