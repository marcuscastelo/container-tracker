-- Runtime enrolment for one-click agent installer:
-- - installer tokens (revocable/expirable, hashed)
-- - enrolled agents (idempotent by tenant + machine fingerprint)
-- - enrollment audit events

create extension if not exists pgcrypto;

create table if not exists public.agent_install_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  token_hash text not null unique,
  description text null,
  revoked_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_install_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists idx_agent_install_tokens_tenant_active
  on public.agent_install_tokens (tenant_id)
  where revoked_at is null;

create table if not exists public.tracking_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  machine_fingerprint text not null,
  hostname text not null,
  os text not null,
  agent_version text not null,
  agent_token text not null,
  interval_sec integer not null default 60,
  limit integer not null default 10,
  supabase_url text null,
  supabase_anon_key text null,
  maersk_enabled boolean not null default false,
  maersk_headless boolean not null default true,
  maersk_timeout_ms integer not null default 120000,
  maersk_user_data_dir text null,
  last_enrolled_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracking_agents_tenant_machine_unique unique (tenant_id, machine_fingerprint),
  constraint tracking_agents_limit_check check (limit between 1 and 100),
  constraint tracking_agents_interval_check check (interval_sec > 0),
  constraint tracking_agents_timeout_check check (maersk_timeout_ms > 0)
);

create unique index if not exists uq_tracking_agents_agent_token
  on public.tracking_agents (agent_token);

create index if not exists idx_tracking_agents_agent_token_active
  on public.tracking_agents (agent_token)
  where revoked_at is null;

create table if not exists public.agent_enrollment_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  status_code integer not null,
  tenant_id uuid null,
  machine_fingerprint text null,
  hostname text null,
  ip_address text null,
  reason text null,
  created_at timestamptz not null default now(),
  constraint agent_enrollment_audit_events_event_type_check check (
    event_type in ('ENROLL_ATTEMPT', 'ENROLL_SUCCESS', 'ENROLL_FAILURE', 'ENROLL_RATE_LIMITED')
  )
);

create index if not exists idx_agent_enrollment_audit_events_created
  on public.agent_enrollment_audit_events (created_at desc);

create index if not exists idx_agent_enrollment_audit_events_tenant_created
  on public.agent_enrollment_audit_events (tenant_id, created_at desc);

create or replace function public.set_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agent_install_tokens_updated_at on public.agent_install_tokens;
create trigger trg_agent_install_tokens_updated_at
before update on public.agent_install_tokens
for each row
execute function public.set_updated_at_column();

drop trigger if exists trg_tracking_agents_updated_at on public.tracking_agents;
create trigger trg_tracking_agents_updated_at
before update on public.tracking_agents
for each row
execute function public.set_updated_at_column();
