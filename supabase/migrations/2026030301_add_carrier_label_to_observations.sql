-- 20260303_01_add_carrier_label_to_observations
-- Preserve original carrier labels for audit-friendly unknown event rendering.
alter table if exists public.container_observations
add column if not exists carrier_label text;
