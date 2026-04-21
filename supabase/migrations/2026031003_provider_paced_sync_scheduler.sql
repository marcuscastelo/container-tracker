-- 20260310_03_provider_paced_sync_scheduler
-- Adds provider-paced scheduler function for sync_requests queue.

create index if not exists idx_sync_requests_done_target_updated_at
  on public.sync_requests (tenant_id, provider, ref_type, ref_value, updated_at desc)
  where status = 'DONE' and ref_type = 'container';

create index if not exists idx_sync_requests_target_created_at
  on public.sync_requests (tenant_id, provider, ref_type, ref_value, created_at desc)
  where ref_type = 'container';

create or replace function public.enqueue_container_sync_batch(
  p_due_window interval default interval '24 hours',
  p_recent_window interval default interval '1 hour',
  p_limit_per_provider integer default 10
)
returns table (
  provider text,
  selected_count integer,
  enqueued_new_count integer,
  deduped_open_count integer
)
language plpgsql
as $function$
declare
  v_now timestamptz := now();
  v_tenant_id uuid;
  v_active_winner_count integer := 0;
begin
  if p_due_window is null or p_due_window <= interval '0 seconds' then
    raise exception 'enqueue_container_sync_batch requires p_due_window > 0'
      using errcode = '22023';
  end if;

  if p_recent_window is null or p_recent_window <= interval '0 seconds' then
    raise exception 'enqueue_container_sync_batch requires p_recent_window > 0'
      using errcode = '22023';
  end if;

  if p_limit_per_provider is null or p_limit_per_provider < 1 then
    raise exception 'enqueue_container_sync_batch requires p_limit_per_provider >= 1'
      using errcode = '22023';
  end if;

  with active_agents as (
    select
      ta.tenant_id,
      count(*)::integer as active_count
    from public.tracking_agents ta
    where ta.revoked_at is null
      and ta.status in ('CONNECTED', 'DEGRADED')
    group by ta.tenant_id
  ),
  max_active as (
    select max(aa.active_count) as max_active_count
    from active_agents aa
  ),
  active_winners as (
    select aa.tenant_id
    from active_agents aa
    inner join max_active ma
      on aa.active_count = ma.max_active_count
  )
  select count(*)::integer
  into v_active_winner_count
  from active_winners;

  if v_active_winner_count = 1 then
    with active_agents as (
      select
        ta.tenant_id,
        count(*)::integer as active_count
      from public.tracking_agents ta
      where ta.revoked_at is null
        and ta.status in ('CONNECTED', 'DEGRADED')
      group by ta.tenant_id
    ),
    max_active as (
      select max(aa.active_count) as max_active_count
      from active_agents aa
    )
    select aa.tenant_id
    into v_tenant_id
    from active_agents aa
    inner join max_active ma
      on aa.active_count = ma.max_active_count
    limit 1;
  end if;

  if v_tenant_id is null then
    select sr.tenant_id
    into v_tenant_id
    from public.sync_requests sr
    order by sr.created_at desc, sr.id desc
    limit 1;
  end if;

  if v_tenant_id is null then
    raise exception 'enqueue_container_sync_batch could not resolve tenant_id'
      using errcode = '22023';
  end if;

  return query
  with candidate_containers as (
    select distinct
      case
        when lower(regexp_replace(coalesce(c.carrier_code, ''), '[^a-zA-Z0-9]+', '', 'g')) in ('maersk', 'msc', 'cmacgm')
          then lower(regexp_replace(coalesce(c.carrier_code, ''), '[^a-zA-Z0-9]+', '', 'g'))
        else null
      end as provider,
      upper(btrim(c.container_number)) as container_number
    from public.containers c
    inner join public.processes p
      on p.id = c.process_id
    where p.archived_at is null
      and p.deleted_at is null
      and c.removed_at is null
      and nullif(btrim(c.container_number), '') is not null
  ),
  eligible_containers as (
    select
      cc.provider,
      cc.container_number
    from candidate_containers cc
    where cc.provider is not null
  ),
  with_last_done as (
    select
      ec.provider,
      ec.container_number,
      max(sr.updated_at) as last_done_at
    from eligible_containers ec
    left join public.sync_requests sr
      on sr.tenant_id = v_tenant_id
      and sr.provider = ec.provider
      and sr.ref_type = 'container'
      and sr.ref_value = ec.container_number
      and sr.status = 'DONE'
    group by ec.provider, ec.container_number
  ),
  due_candidates as (
    select
      wld.provider,
      wld.container_number,
      wld.last_done_at
    from with_last_done wld
    where wld.last_done_at is null
      or wld.last_done_at < (v_now - p_due_window)
  ),
  without_recent as (
    select
      dc.provider,
      dc.container_number,
      dc.last_done_at
    from due_candidates dc
    where not exists (
      select 1
      from public.sync_requests sr
      where sr.tenant_id = v_tenant_id
        and sr.provider = dc.provider
        and sr.ref_type = 'container'
        and sr.ref_value = dc.container_number
        and sr.created_at >= (v_now - p_recent_window)
    )
  ),
  ranked as (
    select
      wr.provider,
      wr.container_number,
      wr.last_done_at,
      row_number() over (
        partition by wr.provider
        order by wr.last_done_at asc nulls first, wr.container_number asc
      ) as row_num
    from without_recent wr
  ),
  selected as (
    select
      r.provider,
      r.container_number
    from ranked r
    where r.row_num <= p_limit_per_provider
  ),
  selected_count_by_provider as (
    select
      s.provider,
      count(*)::integer as selected_count
    from selected s
    group by s.provider
  ),
  enqueue_calls as (
    select
      s.provider,
      er.is_new
    from selected s
    cross join lateral public.enqueue_sync_request(
      v_tenant_id,
      s.provider,
      'container',
      s.container_number,
      0
    ) er
  ),
  enqueue_count_by_provider as (
    select
      ec.provider,
      count(*) filter (where ec.is_new)::integer as enqueued_new_count,
      count(*) filter (where not ec.is_new)::integer as deduped_open_count
    from enqueue_calls ec
    group by ec.provider
  ),
  provider_union as (
    select provider from selected_count_by_provider
    union
    select provider from enqueue_count_by_provider
  )
  select
    pu.provider,
    coalesce(sc.selected_count, 0)::integer as selected_count,
    coalesce(ec.enqueued_new_count, 0)::integer as enqueued_new_count,
    coalesce(ec.deduped_open_count, 0)::integer as deduped_open_count
  from provider_union pu
  left join selected_count_by_provider sc
    on sc.provider = pu.provider
  left join enqueue_count_by_provider ec
    on ec.provider = pu.provider
  order by pu.provider;
end;
$function$;
