-- 2026022401_local_bootstrap_core_tables
-- Local-only bootstrap for legacy core tables that predate versioned migrations.
-- Keeps local db reset reproducible without any remote project dependency.

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  reference text,
  origin jsonb,
  destination jsonb,
  carrier text,
  bill_of_lading text,
  booking_reference text,
  source text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  client_id uuid,
  importer_name text,
  exporter_name text,
  reference_importer text,
  booking_number text,
  archived_at timestamptz,
  deleted_at timestamptz,
  product text,
  redestination_number text,
  depositary text
);

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null default gen_random_uuid() references public.processes (id) on update cascade on delete cascade,
  container_number text not null,
  carrier_code text not null,
  container_type text,
  container_size text,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create table if not exists public.container_snapshots (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null default gen_random_uuid() references public.containers (id) on update cascade on delete cascade,
  provider text not null,
  fetched_at timestamptz not null,
  payload json not null,
  parse_error text
);

create table if not exists public.container_observations (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  container_id uuid not null references public.containers (id) on update cascade on delete cascade,
  container_number text not null,
  type text not null,
  event_time timestamptz,
  location_code text,
  location_display text,
  vessel_name text,
  voyage text,
  is_empty boolean,
  confidence text not null,
  provider text not null,
  created_from_snapshot_id uuid references public.container_snapshots (id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  retroactive boolean not null default false,
  event_time_type text not null,
  carrier_label text,
  temporal_kind text,
  event_time_instant timestamptz,
  event_date date,
  event_time_local text,
  event_time_zone text,
  event_time_source text,
  raw_event_time text
);

create table if not exists public.tracking_alerts (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null default gen_random_uuid() references public.containers (id) on update cascade on delete cascade,
  category text not null,
  type text not null,
  severity text not null,
  detected_at timestamptz not null,
  triggered_at timestamptz not null,
  source_observation_fingerprints jsonb not null,
  retroactive boolean not null default false,
  provider text,
  acked_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  alert_fingerprint text,
  acked_by text,
  acked_source text,
  message text,
  message_key text,
  message_params jsonb not null default '{}'::jsonb,
  lifecycle_state text,
  resolved_at timestamptz,
  resolved_reason text
);

create index if not exists container_observations_container_id_idx
  on public.container_observations (container_id);

create index if not exists container_observations_event_time_idx
  on public.container_observations (event_time);

create index if not exists idx_containers_process_number
  on public.containers (process_id, container_number);

create index if not exists tracking_alerts_active_idx
  on public.tracking_alerts (container_id)
  where acked_at is null;
