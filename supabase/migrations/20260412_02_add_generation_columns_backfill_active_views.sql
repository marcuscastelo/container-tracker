-- 20260412_02_add_generation_columns_backfill_active_views
-- Adds derivation_generation_id to derived tables, backfills legacy data,
-- and creates active-generation read views + generation auto-resolve triggers.

alter table if exists public.container_observations
  add column if not exists derivation_generation_id uuid null;

alter table if exists public.tracking_alerts
  add column if not exists derivation_generation_id uuid null;

with containers_with_derived_data as (
  select distinct o.container_id
  from public.container_observations o
  where o.container_id is not null
  union
  select distinct a.container_id
  from public.tracking_alerts a
  where a.container_id is not null
), inserted_generations as (
  insert into public.tracking_derivation_generations (
    container_id,
    source_kind,
    source_run_id,
    created_at,
    activated_at,
    metadata_json
  )
  select
    c.container_id,
    'LIVE',
    null,
    now(),
    now(),
    jsonb_build_object('bootstrap', 'legacy_backfill_20260412')
  from containers_with_derived_data c
  where not exists (
    select 1
    from public.tracking_derivation_generations g
    where g.container_id = c.container_id
  )
  returning id, container_id
)
insert into public.tracking_generation_pointers (
  container_id,
  active_generation_id,
  previous_generation_id,
  updated_at,
  updated_by_run_id
)
select
  g.container_id,
  g.id,
  null,
  now(),
  null
from public.tracking_derivation_generations g
where not exists (
  select 1
  from public.tracking_generation_pointers p
  where p.container_id = g.container_id
)
and not exists (
  select 1
  from public.tracking_generation_pointers p2
  where p2.active_generation_id = g.id
)
on conflict (container_id) do nothing;

update public.container_observations o
set derivation_generation_id = p.active_generation_id
from public.tracking_generation_pointers p
where p.container_id = o.container_id
  and o.derivation_generation_id is null;

update public.tracking_alerts a
set derivation_generation_id = p.active_generation_id
from public.tracking_generation_pointers p
where p.container_id = a.container_id
  and a.derivation_generation_id is null;

alter table if exists public.container_observations
  drop constraint if exists container_observations_derivation_generation_id_fkey;

alter table if exists public.container_observations
  add constraint container_observations_derivation_generation_id_fkey
  foreign key (derivation_generation_id)
  references public.tracking_derivation_generations(id)
  on delete restrict;

alter table if exists public.tracking_alerts
  drop constraint if exists tracking_alerts_derivation_generation_id_fkey;

alter table if exists public.tracking_alerts
  add constraint tracking_alerts_derivation_generation_id_fkey
  foreign key (derivation_generation_id)
  references public.tracking_derivation_generations(id)
  on delete restrict;

do $$
declare
  v_missing_observations bigint;
  v_missing_alerts bigint;
begin
  select count(*) into v_missing_observations
  from public.container_observations
  where derivation_generation_id is null;

  select count(*) into v_missing_alerts
  from public.tracking_alerts
  where derivation_generation_id is null;

  if v_missing_observations > 0 then
    raise exception 'container_observations backfill failed: % rows still null derivation_generation_id', v_missing_observations;
  end if;

  if v_missing_alerts > 0 then
    raise exception 'tracking_alerts backfill failed: % rows still null derivation_generation_id', v_missing_alerts;
  end if;
end
$$;

alter table if exists public.container_observations
  alter column derivation_generation_id set not null;

alter table if exists public.tracking_alerts
  alter column derivation_generation_id set not null;

create index if not exists idx_container_observations_container_generation_created
  on public.container_observations (container_id, derivation_generation_id, created_at asc, id asc);

create index if not exists idx_tracking_alerts_container_generation_triggered
  on public.tracking_alerts (container_id, derivation_generation_id, triggered_at desc, id desc);

create or replace view public.active_container_observations as
select o.*
from public.container_observations o
inner join public.tracking_generation_pointers p
  on p.container_id = o.container_id
 and p.active_generation_id = o.derivation_generation_id;

create or replace view public.active_tracking_alerts as
select a.*
from public.tracking_alerts a
inner join public.tracking_generation_pointers p
  on p.container_id = a.container_id
 and p.active_generation_id = a.derivation_generation_id;

create or replace function public.resolve_or_create_active_tracking_generation(
  p_container_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_generation_id uuid;
  v_new_generation_id uuid;
begin
  if p_container_id is null then
    raise exception 'resolve_or_create_active_tracking_generation requires container_id'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_container_id::text, 0));

  select p.active_generation_id
  into v_active_generation_id
  from public.tracking_generation_pointers p
  where p.container_id = p_container_id
  for update;

  if v_active_generation_id is not null then
    return v_active_generation_id;
  end if;

  insert into public.tracking_derivation_generations (
    container_id,
    source_kind,
    source_run_id,
    created_at,
    activated_at,
    metadata_json
  )
  values (
    p_container_id,
    'LIVE',
    null,
    now(),
    now(),
    jsonb_build_object('auto_created', true)
  )
  returning id into v_new_generation_id;

  insert into public.tracking_generation_pointers (
    container_id,
    active_generation_id,
    previous_generation_id,
    updated_at,
    updated_by_run_id
  )
  values (
    p_container_id,
    v_new_generation_id,
    null,
    now(),
    null
  )
  on conflict (container_id) do nothing;

  select p.active_generation_id
  into v_active_generation_id
  from public.tracking_generation_pointers p
  where p.container_id = p_container_id;

  if v_active_generation_id is null then
    return v_new_generation_id;
  end if;

  return v_active_generation_id;
end;
$$;

create or replace function public.set_tracking_observation_generation_from_active_pointer()
returns trigger
language plpgsql
as $$
begin
  if new.derivation_generation_id is null then
    new.derivation_generation_id := public.resolve_or_create_active_tracking_generation(new.container_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_container_observations_set_generation on public.container_observations;

create trigger trg_container_observations_set_generation
before insert on public.container_observations
for each row
execute function public.set_tracking_observation_generation_from_active_pointer();

create or replace function public.set_tracking_alert_generation_from_active_pointer()
returns trigger
language plpgsql
as $$
begin
  if new.derivation_generation_id is null then
    new.derivation_generation_id := public.resolve_or_create_active_tracking_generation(new.container_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tracking_alerts_set_generation on public.tracking_alerts;

create trigger trg_tracking_alerts_set_generation
before insert on public.tracking_alerts
for each row
execute function public.set_tracking_alert_generation_from_active_pointer();
