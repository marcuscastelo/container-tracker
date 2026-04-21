-- 20260412_01_create_tracking_replay_core
-- Tracking replay operational tables + generation pointers + active replay lock table.

create extension if not exists pgcrypto;

create table if not exists public.tracking_replay_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  mode text not null,
  requested_by text not null,
  reason text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  code_version text null,
  error_message text null,
  summary_json jsonb not null default '{}'::jsonb
);

alter table if exists public.tracking_replay_runs
  drop constraint if exists tracking_replay_runs_status_check;

alter table if exists public.tracking_replay_runs
  add constraint tracking_replay_runs_status_check
  check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'APPLIED', 'ROLLED_BACK'));

alter table if exists public.tracking_replay_runs
  drop constraint if exists tracking_replay_runs_mode_check;

alter table if exists public.tracking_replay_runs
  add constraint tracking_replay_runs_mode_check
  check (mode in ('DRY_RUN', 'APPLY', 'ROLLBACK'));

create index if not exists idx_tracking_replay_runs_created_at_desc
  on public.tracking_replay_runs (created_at desc);

create table if not exists public.tracking_derivation_generations (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.containers(id) on delete cascade,
  source_kind text not null,
  source_run_id uuid null references public.tracking_replay_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  superseded_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb
);

alter table if exists public.tracking_derivation_generations
  drop constraint if exists tracking_derivation_generations_source_kind_check;

alter table if exists public.tracking_derivation_generations
  add constraint tracking_derivation_generations_source_kind_check
  check (source_kind in ('LIVE', 'REPLAY'));

create index if not exists idx_tracking_derivation_generations_container_created_at_desc
  on public.tracking_derivation_generations (container_id, created_at desc, id desc);

create table if not exists public.tracking_generation_pointers (
  container_id uuid primary key references public.containers(id) on delete cascade,
  active_generation_id uuid not null references public.tracking_derivation_generations(id) on delete restrict,
  previous_generation_id uuid null references public.tracking_derivation_generations(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by_run_id uuid null references public.tracking_replay_runs(id) on delete set null
);

alter table if exists public.tracking_generation_pointers
  drop constraint if exists tracking_generation_pointers_distinct_generations_check;

alter table if exists public.tracking_generation_pointers
  add constraint tracking_generation_pointers_distinct_generations_check
  check (previous_generation_id is null or previous_generation_id <> active_generation_id);

create index if not exists idx_tracking_generation_pointers_active_generation
  on public.tracking_generation_pointers (active_generation_id);

create table if not exists public.tracking_replay_run_targets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.tracking_replay_runs(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  container_number text not null,
  provider text null,
  snapshot_count integer not null default 0,
  status text not null,
  error_message text null,
  diff_summary_json jsonb not null default '{}'::jsonb,
  created_generation_id uuid null references public.tracking_derivation_generations(id) on delete set null,
  lock_heartbeat_at timestamptz null,
  lock_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.tracking_replay_run_targets
  drop constraint if exists tracking_replay_run_targets_status_check;

alter table if exists public.tracking_replay_run_targets
  add constraint tracking_replay_run_targets_status_check
  check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'APPLIED', 'ROLLED_BACK'));

create index if not exists idx_tracking_replay_run_targets_run_id
  on public.tracking_replay_run_targets (run_id);

create index if not exists idx_tracking_replay_run_targets_container_updated_at_desc
  on public.tracking_replay_run_targets (container_id, updated_at desc);

create table if not exists public.tracking_replay_locks (
  container_id uuid primary key references public.containers(id) on delete cascade,
  run_id uuid not null references public.tracking_replay_runs(id) on delete cascade,
  run_target_id uuid not null references public.tracking_replay_run_targets(id) on delete cascade,
  owner_token uuid not null,
  mode text not null,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table if exists public.tracking_replay_locks
  drop constraint if exists tracking_replay_locks_mode_check;

alter table if exists public.tracking_replay_locks
  add constraint tracking_replay_locks_mode_check
  check (mode in ('DRY_RUN', 'APPLY', 'ROLLBACK'));

create index if not exists idx_tracking_replay_locks_expires_at
  on public.tracking_replay_locks (expires_at asc);

create or replace function public.set_tracking_replay_run_targets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tracking_replay_run_targets_set_updated_at on public.tracking_replay_run_targets;

create trigger trg_tracking_replay_run_targets_set_updated_at
before update on public.tracking_replay_run_targets
for each row
execute function public.set_tracking_replay_run_targets_updated_at();

create or replace function public.set_tracking_generation_pointers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tracking_generation_pointers_set_updated_at on public.tracking_generation_pointers;

create trigger trg_tracking_generation_pointers_set_updated_at
before update on public.tracking_generation_pointers
for each row
execute function public.set_tracking_generation_pointers_updated_at();
