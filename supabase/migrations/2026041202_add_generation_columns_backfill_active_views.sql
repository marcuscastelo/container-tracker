-- 20260412_02_add_generation_columns_backfill_active_views
-- Repair-first version.
--
-- Purpose:
-- 1) add derivation_generation_id to derived tables
-- 2) guarantee a valid LIVE generation for every container that already has derived data
-- 3) guarantee/repair active generation pointers
-- 4) backfill legacy rows
-- 5) expose active-generation views + generation auto-resolve triggers

alter table if exists public.container_observations
  add column if not exists derivation_generation_id uuid null;

alter table if exists public.tracking_alerts
  add column if not exists derivation_generation_id uuid null;

-- 1) Ensure every container with derived data has at least one generation
with containers_with_derived_data as (
  select distinct o.container_id
  from public.container_observations o
  where o.container_id is not null

  union

  select distinct a.container_id
  from public.tracking_alerts a
  where a.container_id is not null
)
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
);

-- 2) Pick the best generation per container
-- Preference:
--   activated_at desc nulls last
--   created_at desc
--   id desc
with best_generation as (
  select distinct on (g.container_id)
    g.container_id,
    g.id as generation_id
  from public.tracking_derivation_generations g
  where g.container_id is not null
  order by
    g.container_id,
    g.activated_at desc nulls last,
    g.created_at desc,
    g.id desc
)
insert into public.tracking_generation_pointers (
  container_id,
  active_generation_id,
  previous_generation_id,
  updated_at,
  updated_by_run_id
)
select
  bg.container_id,
  bg.generation_id,
  null,
  now(),
  null
from best_generation bg
on conflict (container_id) do update
set
  active_generation_id = excluded.active_generation_id,
  updated_at = now()
where
  public.tracking_generation_pointers.active_generation_id is null
  or not exists (
    select 1
    from public.tracking_derivation_generations g_ok
    where g_ok.id = public.tracking_generation_pointers.active_generation_id
      and g_ok.container_id = public.tracking_generation_pointers.container_id
  );

-- 3) Repair invalid previous_generation_id values defensively
update public.tracking_generation_pointers p
set
  previous_generation_id = null,
  updated_at = now()
where
  previous_generation_id is not null
  and (
    previous_generation_id = active_generation_id
    or not exists (
      select 1
      from public.tracking_derivation_generations g_prev
      where g_prev.id = p.previous_generation_id
        and g_prev.container_id = p.container_id
    )
  );

-- 4) Validate generation/pointer bootstrap before backfill
do $$
declare
  v_missing_generation_containers bigint;
  v_missing_pointer_containers bigint;
  v_invalid_active_pointer_containers bigint;
begin
  select count(*) into v_missing_generation_containers
  from (
    select distinct c.container_id
    from (
      select distinct o.container_id
      from public.container_observations o
      where o.container_id is not null

      union

      select distinct a.container_id
      from public.tracking_alerts a
      where a.container_id is not null
    ) c
    left join public.tracking_derivation_generations g
      on g.container_id = c.container_id
    where g.id is null
  ) t;

  select count(*) into v_missing_pointer_containers
  from (
    select distinct c.container_id
    from (
      select distinct o.container_id
      from public.container_observations o
      where o.container_id is not null

      union

      select distinct a.container_id
      from public.tracking_alerts a
      where a.container_id is not null
    ) c
    left join public.tracking_generation_pointers p
      on p.container_id = c.container_id
    where p.container_id is null
  ) t;

  select count(*) into v_invalid_active_pointer_containers
  from (
    select distinct p.container_id
    from public.tracking_generation_pointers p
    left join public.tracking_derivation_generations g
      on g.id = p.active_generation_id
    where g.id is null
       or g.container_id <> p.container_id
  ) t;

  if v_missing_generation_containers > 0 then
    raise exception
      'generation bootstrap failed: % containers with derived data still missing tracking_derivation_generations rows',
      v_missing_generation_containers;
  end if;

  if v_missing_pointer_containers > 0 then
    raise exception
      'pointer bootstrap failed: % containers with derived data still missing tracking_generation_pointers rows',
      v_missing_pointer_containers;
  end if;

  if v_invalid_active_pointer_containers > 0 then
    raise exception
      'pointer validation failed: % containers have invalid active_generation_id in tracking_generation_pointers',
      v_invalid_active_pointer_containers;
  end if;
end
$$;

-- 5) Backfill legacy derived rows from active pointers
update public.container_observations o
set derivation_generation_id = p.active_generation_id
from public.tracking_generation_pointers p
where p.container_id = o.container_id
  and p.active_generation_id is not null
  and o.derivation_generation_id is null;

update public.tracking_alerts a
set derivation_generation_id = p.active_generation_id
from public.tracking_generation_pointers p
where p.container_id = a.container_id
  and p.active_generation_id is not null
  and a.derivation_generation_id is null;

-- 6) Foreign keys
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

-- 7) Final backfill validation
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
    raise exception
      'container_observations backfill failed: % rows still null derivation_generation_id',
      v_missing_observations;
  end if;

  if v_missing_alerts > 0 then
    raise exception
      'tracking_alerts backfill failed: % rows still null derivation_generation_id',
      v_missing_alerts;
  end if;
end
$$;

-- 8) Enforce non-null after successful backfill
alter table if exists public.container_observations
  alter column derivation_generation_id set not null;

alter table if exists public.tracking_alerts
  alter column derivation_generation_id set not null;

-- 9) Supporting indexes
create index if not exists idx_container_observations_container_generation_created
  on public.container_observations (container_id, derivation_generation_id, created_at asc, id asc);

create index if not exists idx_tracking_alerts_container_generation_triggered
  on public.tracking_alerts (container_id, derivation_generation_id, triggered_at desc, id desc);

-- 10) Active-generation read views
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

-- 11) Auto-resolve active generation for new LIVE inserts
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
  on conflict (container_id) do update
  set
    active_generation_id = excluded.active_generation_id,
    updated_at = now()
  where public.tracking_generation_pointers.active_generation_id is null;

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