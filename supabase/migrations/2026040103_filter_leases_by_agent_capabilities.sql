-- 20260401_03_filter_leases_by_agent_capabilities
-- Prevents agents from leasing sync requests for providers they cannot process.

drop function if exists public.lease_sync_requests(uuid, text, integer, integer, boolean);

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
