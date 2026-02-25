-- MVP Agent Sync queue + atomic leasing function
-- Date: 2026-02-25

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'sync_request_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.sync_request_status as enum ('PENDING', 'LEASED', 'DONE', 'FAILED');
  end if;
end $$;

create table if not exists public.sync_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  ref_type text not null,
  ref_value text not null,
  status public.sync_request_status not null default 'PENDING',
  priority integer not null default 0,
  leased_by text null,
  leased_until timestamptz null,
  attempts integer not null default 0,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_requests_ref_type_check check (ref_type = 'container'),
  constraint sync_requests_provider_check check (provider in ('maersk', 'msc', 'cmacgm'))
);

create index if not exists idx_sync_requests_tenant_status_priority_created
  on public.sync_requests (tenant_id, status, priority desc, created_at asc);

create index if not exists idx_sync_requests_tenant_status_lease
  on public.sync_requests (tenant_id, status, leased_until);

create or replace function public.set_sync_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_requests_set_updated_at on public.sync_requests;

create trigger trg_sync_requests_set_updated_at
before update on public.sync_requests
for each row
execute function public.set_sync_requests_updated_at();

create or replace function public.lease_sync_requests(
  p_tenant_id uuid,
  p_agent_id text,
  p_limit integer default 10,
  p_lease_minutes integer default 5
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
begin
  return query
  with candidate as (
    select sr.id
    from public.sync_requests sr
    where sr.tenant_id = p_tenant_id
      and (
        sr.status = 'PENDING'
        or (sr.status = 'LEASED' and sr.leased_until is not null and sr.leased_until < v_now)
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

