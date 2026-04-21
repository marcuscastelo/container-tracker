create or replace function public.enqueue_sync_request(
  p_tenant_id uuid,
  p_provider text,
  p_ref_type text default 'container'::text,
  p_ref_value text default ''::text,
  p_priority integer default 0
)
returns table(
  id uuid,
  status public.sync_request_status,
  is_new boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ref_type text := coalesce(nullif(trim(p_ref_type), ''), 'container');
  v_ref_value text := upper(trim(p_ref_value));
  v_id uuid;
  v_status public.sync_request_status;
begin
  if v_ref_type <> 'container' then
    raise exception 'enqueue_sync_request only supports ref_type=container (got %)', v_ref_type
      using errcode = '22023';
  end if;

  if v_ref_value = '' then
    raise exception 'enqueue_sync_request requires a non-empty ref_value'
      using errcode = '22023';
  end if;

  begin
    insert into public.sync_requests (
      tenant_id,
      provider,
      ref_type,
      ref_value,
      status,
      priority
    )
    values (
      p_tenant_id,
      p_provider,
      v_ref_type,
      v_ref_value,
      'PENDING',
      coalesce(p_priority, 0)
    )
    returning sync_requests.id, sync_requests.status
    into v_id, v_status;

    return query
    select v_id, v_status, true;

  exception
    when unique_violation then
      select sr.id, sr.status
      into v_id, v_status
      from public.sync_requests sr
      where sr.tenant_id = p_tenant_id
        and sr.provider = p_provider
        and sr.ref_type = v_ref_type
        and sr.ref_value = v_ref_value
        and sr.status in ('PENDING', 'LEASED')
      order by
        case when sr.status = 'PENDING' then 0 else 1 end,
        sr.priority desc,
        sr.created_at asc
      limit 1;

      if v_id is null then
        raise;
      end if;

      return query
      select v_id, v_status, false;
  end;
end;
$function$;