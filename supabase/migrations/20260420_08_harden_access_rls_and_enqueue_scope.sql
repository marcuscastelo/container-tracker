-- 20260420_08_harden_access_rls_and_enqueue_scope
-- Follow-up hardening for tenant defaults, RLS helper safety and enqueue RPC scope.

-- Migration-time backfill helper must not remain as live default on operational tables.
alter table if exists public.processes
alter column platform_tenant_id drop default;

alter table if exists public.containers
alter column platform_tenant_id drop default;

alter table if exists public.container_snapshots
alter column platform_tenant_id drop default;

alter table if exists public.container_observations
alter column platform_tenant_id drop default;

alter table if exists public.tracking_alerts
alter column platform_tenant_id drop default;

alter table if exists public.sync_requests
alter column platform_tenant_id drop default;

alter table if exists public.tracking_agents
alter column platform_tenant_id drop default;

create or replace function private.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with claims as (
    select auth.jwt()->>'sub' as workos_user_id
  )
  select exists (
    select 1
    from public.platform_superadmins psa
    where psa.workos_user_id = (select claims.workos_user_id from claims)
      and psa.status = 'ACTIVE'
  );
$$;

create or replace function private.has_active_membership(p_platform_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with claims as (
    select auth.jwt()->>'sub' as workos_user_id
  )
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.platform_tenants pt
      on pt.id = tm.platform_tenant_id
    where tm.workos_user_id = (select claims.workos_user_id from claims)
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and pt.status = 'ACTIVE'
  );
$$;

create or replace function private.is_tenant_admin(p_platform_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with claims as (
    select auth.jwt()->>'sub' as workos_user_id
  )
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.platform_tenants pt
      on pt.id = tm.platform_tenant_id
    where tm.workos_user_id = (select claims.workos_user_id from claims)
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and tm.role_code = 'ADMIN'
      and pt.status = 'ACTIVE'
  );
$$;

create or replace function private.has_importer_access(
  p_platform_tenant_id uuid,
  p_importer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with claims as (
    select auth.jwt()->>'sub' as workos_user_id
  )
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.platform_tenants pt
      on pt.id = tm.platform_tenant_id
    join public.membership_importer_access mia
      on mia.membership_id = tm.id
    join public.importers i
      on i.id = mia.importer_id
    where tm.workos_user_id = (select claims.workos_user_id from claims)
      and tm.platform_tenant_id = p_platform_tenant_id
      and tm.status = 'ACTIVE'
      and tm.role_code = 'IMPORTER'
      and pt.status = 'ACTIVE'
      and i.id = p_importer_id
      and i.platform_tenant_id = p_platform_tenant_id
      and i.status = 'ACTIVE'
  );
$$;

create or replace function private.can_access_row(
  p_platform_tenant_id uuid,
  p_importer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (
    private.is_tenant_admin(p_platform_tenant_id)
    or (
      p_importer_id is not null
      and private.has_importer_access(p_platform_tenant_id, p_importer_id)
    )
  );
$$;

drop policy if exists users_write on public.users;
create policy users_write
on public.users
for update
to authenticated
using (workos_user_id = auth.jwt()->>'sub')
with check (workos_user_id = auth.jwt()->>'sub');

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
set search_path = pg_catalog, public, private
as $$
declare
  v_ref_type text := coalesce(nullif(trim(p_ref_type), ''), 'container');
  v_ref_value text := upper(trim(p_ref_value));
  v_id uuid;
  v_status public.sync_request_status;
  v_attempt integer := 0;
  v_caller_role text := coalesce(auth.role(), '');
  v_workos_subject text := auth.jwt()->>'sub';
begin
  if p_tenant_id is null then
    raise exception 'enqueue_sync_request requires p_tenant_id'
      using errcode = '22023';
  end if;

  if v_ref_type <> 'container' then
    raise exception 'enqueue_sync_request only supports ref_type=container (got %)', v_ref_type
      using errcode = '22023';
  end if;

  if v_ref_value = '' then
    raise exception 'enqueue_sync_request requires a non-empty ref_value'
      using errcode = '22023';
  end if;

  if v_caller_role in ('anon', 'authenticated') then
    if v_workos_subject is null or v_workos_subject = '' then
      raise exception 'forbidden tenant scope for enqueue_sync_request'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.tenant_memberships tm
      join public.platform_tenants pt
        on pt.id = tm.platform_tenant_id
      where tm.workos_user_id = v_workos_subject
        and tm.platform_tenant_id = p_tenant_id
        and tm.status = 'ACTIVE'
        and pt.status = 'ACTIVE'
    ) then
      raise exception 'forbidden tenant scope for enqueue_sync_request'
        using errcode = '42501';
    end if;
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

revoke all on function public.enqueue_sync_request(uuid, text, text, text, integer) from public;
grant execute on function public.enqueue_sync_request(uuid, text, text, text, integer) to service_role;
