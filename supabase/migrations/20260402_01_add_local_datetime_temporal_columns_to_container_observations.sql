-- 20260402_01_add_local_datetime_temporal_columns_to_container_observations
-- Extend container observations to store local wall-clock datetimes and audit metadata.

alter table if exists public.container_observations
add column if not exists event_time_local text,
add column if not exists event_time_zone text,
add column if not exists event_time_source text,
add column if not exists raw_event_time text;

alter table if exists public.container_observations
drop constraint if exists container_observations_temporal_kind_check;

alter table if exists public.container_observations
add constraint container_observations_temporal_kind_check
check (temporal_kind in ('instant', 'date', 'local_datetime') or temporal_kind is null)
not valid;

alter table if exists public.container_observations
drop constraint if exists container_observations_temporal_value_shape_check;

alter table if exists public.container_observations
add constraint container_observations_temporal_value_shape_check
check (
  (
    temporal_kind is null
    and event_time_instant is null
    and event_date is null
    and event_time_local is null
    and event_time_zone is null
  )
  or (
    temporal_kind = 'instant'
    and event_time_instant is not null
    and event_date is null
    and event_time_local is null
    and event_time_zone is null
  )
  or (
    temporal_kind = 'date'
    and event_time_instant is null
    and event_date is not null
    and event_time_local is null
  )
  or (
    temporal_kind = 'local_datetime'
    and event_time_instant is null
    and event_date is null
    and event_time_local is not null
    and event_time_zone is not null
  )
)
not valid;

alter table if exists public.container_observations
drop constraint if exists container_observations_event_time_source_check;

alter table if exists public.container_observations
add constraint container_observations_event_time_source_check
check (
  event_time_source in (
    'carrier_explicit_timezone',
    'carrier_local_port_time',
    'carrier_date_only',
    'derived_fallback',
    'unknown'
  )
  or event_time_source is null
)
not valid;
