-- 20260420_02_operational_tenant_columns
-- Add platform_tenant_id to operational tables.

alter table if exists public.processes
add column if not exists platform_tenant_id uuid;

alter table if exists public.containers
add column if not exists platform_tenant_id uuid;

alter table if exists public.container_snapshots
add column if not exists platform_tenant_id uuid;

alter table if exists public.container_observations
add column if not exists platform_tenant_id uuid;

alter table if exists public.tracking_alerts
add column if not exists platform_tenant_id uuid;

alter table if exists public.sync_requests
add column if not exists platform_tenant_id uuid;

alter table if exists public.tracking_agents
add column if not exists platform_tenant_id uuid;

alter table if exists public.tracking_agent_activity_events
add column if not exists platform_tenant_id uuid;

alter table if exists public.agent_install_tokens
add column if not exists platform_tenant_id uuid;

alter table if exists public.agent_enrollment_audit_events
add column if not exists platform_tenant_id uuid;

alter table if exists public.agent_control_commands
add column if not exists platform_tenant_id uuid;

alter table if exists public.agent_log_events
add column if not exists platform_tenant_id uuid;

update public.sync_requests
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.tracking_agents
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.tracking_agent_activity_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_install_tokens
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_enrollment_audit_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_control_commands
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

update public.agent_log_events
set platform_tenant_id = tenant_id
where platform_tenant_id is null
  and tenant_id is not null;

create index if not exists idx_processes_platform_tenant_id
  on public.processes (platform_tenant_id, created_at desc);

create index if not exists idx_containers_platform_tenant_id
  on public.containers (platform_tenant_id, created_at desc);

create index if not exists idx_container_snapshots_platform_tenant_id
  on public.container_snapshots (platform_tenant_id, fetched_at desc);

create index if not exists idx_container_observations_platform_tenant_id
  on public.container_observations (platform_tenant_id, created_at desc);

create index if not exists idx_tracking_alerts_platform_tenant_id
  on public.tracking_alerts (platform_tenant_id, triggered_at desc);

create index if not exists idx_sync_requests_platform_tenant_id
  on public.sync_requests (platform_tenant_id, status, updated_at desc);

create index if not exists idx_tracking_agents_platform_tenant_id
  on public.tracking_agents (platform_tenant_id, updated_at desc);

create index if not exists idx_tracking_agent_activity_events_platform_tenant_id
  on public.tracking_agent_activity_events (platform_tenant_id, occurred_at desc);

create index if not exists idx_agent_install_tokens_platform_tenant_id
  on public.agent_install_tokens (platform_tenant_id, created_at desc);

create index if not exists idx_agent_enrollment_audit_events_platform_tenant_id
  on public.agent_enrollment_audit_events (platform_tenant_id, created_at desc);

create index if not exists idx_agent_control_commands_platform_tenant_id
  on public.agent_control_commands (platform_tenant_id, requested_at desc);

create index if not exists idx_agent_log_events_platform_tenant_id
  on public.agent_log_events (platform_tenant_id, created_at desc);
