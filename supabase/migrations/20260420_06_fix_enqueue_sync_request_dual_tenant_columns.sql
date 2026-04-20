-- Ensure queue-first enqueue keeps legacy and new tenant columns aligned.
-- Without this, table default on platform_tenant_id can diverge from p_tenant_id
-- and trigger sync_tenant_columns raises: tenant_id and platform_tenant_id must match.

create or replace function public.enqueue_sync_request(
  p_tenant_id uuid,
  p_provider text,
  p_ref_type text default 'container',
  p_ref_value text default '',
  p_priority integer default 0
)
returns table (
  id uuid,
  status public.sync_request_status,
  is_new boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_type text := coalesce(nullif(trim(p_ref_type), ''), 'container');
  v_ref_value text := upper(trim(p_ref_value));
  v_id uuid;
  v_status public.sync_request_status;
  v_attempt integer := 0;
begin
  if v_ref_type <> 'container' then
    raise exception 'enqueue_sync_request only supports ref_type=container (got %)', v_ref_type
      using errcode = '22023';
  end if;

  if v_ref_value = '' then
    raise exception 'enqueue_sync_request requires a non-empty ref_value'
      using errcode = '22023';
  end if;

  loop
    v_attempt := v_attempt + 1;

    begin
      insert into public.sync_requests (
        tenant_id,
        platform_tenant_id,
        provider,
        ref_type,
        ref_value,
        status,
        priority
      )
      values (
        p_tenant_id,
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
      return;
    exception
      when unique_violation then
        v_id := null;
        v_status := null;

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

        if v_id is not null then
          return query
          select v_id, v_status, false;
          return;
        end if;

        if v_attempt >= 2 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

