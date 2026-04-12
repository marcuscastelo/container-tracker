-- 20260412_03_replay_lock_functions_and_sync_guards
-- Adds DB lock functions (acquire/heartbeat/release) and prevents scheduler lease on replay-locked containers.

create index if not exists idx_containers_number_normalized
  on public.containers ((upper(trim(container_number))));

create or replace function public.acquire_tracking_replay_lock(
  p_container_id uuid,
  p_run_id uuid,
  p_run_target_id uuid,
  p_mode text,
  p_owner_token uuid,
  p_ttl_seconds integer default 120
)
returns table (
  acquired boolean,
  lock_owner_run_target_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ttl_seconds integer := greatest(coalesce(p_ttl_seconds, 120), 30);
  v_existing public.tracking_replay_locks%rowtype;
begin
  if p_container_id is null then
    raise exception 'acquire_tracking_replay_lock requires p_container_id'
      using errcode = '22023';
  end if;

  if p_run_id is null or p_run_target_id is null or p_owner_token is null then
    raise exception 'acquire_tracking_replay_lock requires run identity and owner token'
      using errcode = '22023';
  end if;

  if p_mode not in ('DRY_RUN', 'APPLY', 'ROLLBACK') then
    raise exception 'acquire_tracking_replay_lock invalid mode: %', p_mode
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_container_id::text, 0));

  delete from public.tracking_replay_locks
  where container_id = p_container_id
    and expires_at <= v_now;

  select *
  into v_existing
  from public.tracking_replay_locks
  where container_id = p_container_id
  for update;

  if found then
    if v_existing.run_target_id = p_run_target_id and v_existing.owner_token = p_owner_token then
      update public.tracking_replay_locks
      set
        run_id = p_run_id,
        mode = p_mode,
        heartbeat_at = v_now,
        expires_at = v_now + make_interval(secs => v_ttl_seconds)
      where container_id = p_container_id
      returning tracking_replay_locks.expires_at into v_existing.expires_at;

      return query
      select true, p_run_target_id, v_existing.expires_at;
      return;
    end if;

    return query
    select false, v_existing.run_target_id, v_existing.expires_at;
    return;
  end if;

  insert into public.tracking_replay_locks (
    container_id,
    run_id,
    run_target_id,
    owner_token,
    mode,
    acquired_at,
    heartbeat_at,
    expires_at
  )
  values (
    p_container_id,
    p_run_id,
    p_run_target_id,
    p_owner_token,
    p_mode,
    v_now,
    v_now,
    v_now + make_interval(secs => v_ttl_seconds)
  )
  returning tracking_replay_locks.expires_at into v_existing.expires_at;

  return query
  select true, p_run_target_id, v_existing.expires_at;
end;
$$;

create or replace function public.heartbeat_tracking_replay_lock(
  p_container_id uuid,
  p_run_target_id uuid,
  p_owner_token uuid,
  p_ttl_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ttl_seconds integer := greatest(coalesce(p_ttl_seconds, 120), 30);
  v_updated_count integer;
begin
  if p_container_id is null or p_run_target_id is null or p_owner_token is null then
    raise exception 'heartbeat_tracking_replay_lock requires lock identity'
      using errcode = '22023';
  end if;

  delete from public.tracking_replay_locks
  where container_id = p_container_id
    and expires_at <= v_now;

  update public.tracking_replay_locks
  set
    heartbeat_at = v_now,
    expires_at = v_now + make_interval(secs => v_ttl_seconds)
  where container_id = p_container_id
    and run_target_id = p_run_target_id
    and owner_token = p_owner_token
    and expires_at > v_now;

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

create or replace function public.release_tracking_replay_lock(
  p_container_id uuid,
  p_run_target_id uuid,
  p_owner_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  if p_container_id is null or p_run_target_id is null or p_owner_token is null then
    raise exception 'release_tracking_replay_lock requires lock identity'
      using errcode = '22023';
  end if;

  delete from public.tracking_replay_locks
  where container_id = p_container_id
    and run_target_id = p_run_target_id
    and owner_token = p_owner_token;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

create or replace function public.has_active_tracking_replay_lock_for_container_number(
  p_container_number text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.containers c
    inner join public.tracking_replay_locks l
      on l.container_id = c.id
    where upper(trim(c.container_number)) = upper(trim(coalesce(p_container_number, '')))
      and l.expires_at > now()
  );
$$;

drop function if exists public.lease_sync_requests(uuid, text, integer, integer, boolean, text[]);

create or replace function public.lease_sync_requests(
  p_tenant_id uuid,
  p_agent_id text,
  p_limit integer default 10,
  p_lease_minutes integer default 5,
  p_include_owned_active_leases boolean default false,
  p_processable_providers text[] default null
)
returns setof public.sync_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limit integer := greatest(coalesce(p_limit, 10), 1);
  v_lease_minutes integer := greatest(coalesce(p_lease_minutes, 5), 1);
  v_has_provider_filter boolean := p_processable_providers is not null;
begin
  return query
  with candidate as (
    select sr.id
    from public.sync_requests sr
    where sr.tenant_id = p_tenant_id
      and (
        not v_has_provider_filter
        or sr.provider = any(p_processable_providers)
      )
      and not exists (
        select 1
        from public.containers c
        inner join public.tracking_replay_locks l
          on l.container_id = c.id
        where sr.ref_type = 'container'
          and upper(trim(c.container_number)) = upper(trim(sr.ref_value))
          and l.expires_at > v_now
      )
      and (
        sr.status = 'PENDING'
        or (sr.status = 'LEASED' and sr.leased_until is not null and sr.leased_until < v_now)
        or (
          coalesce(p_include_owned_active_leases, false)
          and sr.status = 'LEASED'
          and sr.leased_by = p_agent_id
          and sr.leased_until is not null
          and sr.leased_until >= v_now
        )
      )
    order by sr.priority desc, sr.created_at asc
    limit v_limit
    for update skip locked
  )
  update public.sync_requests sr
  set
    status = 'LEASED',
    leased_by = p_agent_id,
    leased_until = v_now + make_interval(mins => v_lease_minutes),
    attempts = sr.attempts + 1,
    updated_at = v_now
  where sr.id in (select id from candidate)
  returning sr.*;
end;
$$;
