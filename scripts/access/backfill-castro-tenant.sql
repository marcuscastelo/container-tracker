-- Backfill helper (idempotent) for legacy single-tenant data.
-- Safe to run after migrations 20260420_01..05.

begin;

insert into public.platform_tenants (id, slug, name, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'castro',
  'Castro',
  'ACTIVE'
)
on conflict (id) do nothing;

update public.processes
set platform_tenant_id = '00000000-0000-4000-8000-000000000001'
where platform_tenant_id is null;

update public.containers c
set platform_tenant_id = p.platform_tenant_id
from public.processes p
where c.process_id = p.id
  and c.platform_tenant_id is distinct from p.platform_tenant_id;

update public.container_snapshots s
set platform_tenant_id = c.platform_tenant_id
from public.containers c
where s.container_id = c.id
  and s.platform_tenant_id is distinct from c.platform_tenant_id;

update public.container_observations o
set platform_tenant_id = c.platform_tenant_id
from public.containers c
where o.container_id = c.id
  and o.platform_tenant_id is distinct from c.platform_tenant_id;

update public.tracking_alerts a
set platform_tenant_id = c.platform_tenant_id
from public.containers c
where a.container_id = c.id
  and a.platform_tenant_id is distinct from c.platform_tenant_id;

update public.sync_requests
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.tracking_agents
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

commit;
