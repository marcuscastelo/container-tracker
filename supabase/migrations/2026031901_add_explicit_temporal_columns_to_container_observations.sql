-- 20260319_01_add_explicit_temporal_columns_to_container_observations
-- Split ambiguous tracking event_time into explicit temporal columns.
--
-- Legacy `event_time` is intentionally kept during the transition so historical
-- rows can be rebuilt from preserved snapshots without guessing temporal kind
-- from persisted values.

alter table if exists public.container_observations
add column if not exists temporal_kind text,
add column if not exists event_time_instant timestamptz,
add column if not exists event_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'container_observations_temporal_kind_check'
  ) then
    alter table public.container_observations
    add constraint container_observations_temporal_kind_check
    check (temporal_kind in ('instant', 'date') or temporal_kind is null)
    not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'container_observations_temporal_value_shape_check'
  ) then
    alter table public.container_observations
    add constraint container_observations_temporal_value_shape_check
    check (
      (temporal_kind is null and event_time_instant is null and event_date is null)
      or (temporal_kind = 'instant' and event_time_instant is not null and event_date is null)
      or (temporal_kind = 'date' and event_time_instant is null and event_date is not null)
    )
    not valid;
  end if;
end
$$;

create index if not exists container_observations_container_id_event_time_instant_idx
on public.container_observations (container_id, event_time_instant asc, created_at asc);

create index if not exists container_observations_container_id_event_date_idx
on public.container_observations (container_id, event_date asc, created_at asc);
