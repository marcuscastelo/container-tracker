-- 20260403_01_tracking_validation_issue_lifecycle_transitions
-- Persist lightweight operational transitions for tracking validation issues.

create table if not exists public.tracking_validation_issue_transitions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  container_id uuid not null references public.containers (id) on delete cascade,
  issue_code text not null,
  detector_id text not null,
  detector_version text not null,
  affected_scope text not null,
  severity text not null,
  transition_type text not null,
  lifecycle_key text not null,
  state_fingerprint text not null,
  evidence_summary text not null,
  provider text not null,
  snapshot_id uuid not null references public.container_snapshots (id) on delete cascade,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.tracking_validation_issue_transitions
drop constraint if exists tracking_validation_issue_transitions_affected_scope_check;

alter table if exists public.tracking_validation_issue_transitions
add constraint tracking_validation_issue_transitions_affected_scope_check
check (affected_scope in ('CONTAINER', 'OPERATIONAL', 'PROCESS', 'SERIES', 'STATUS', 'TIMELINE'));

alter table if exists public.tracking_validation_issue_transitions
drop constraint if exists tracking_validation_issue_transitions_severity_check;

alter table if exists public.tracking_validation_issue_transitions
add constraint tracking_validation_issue_transitions_severity_check
check (severity in ('ADVISORY', 'CRITICAL'));

alter table if exists public.tracking_validation_issue_transitions
drop constraint if exists tracking_validation_issue_transitions_transition_type_check;

alter table if exists public.tracking_validation_issue_transitions
add constraint tracking_validation_issue_transitions_transition_type_check
check (transition_type in ('activated', 'changed', 'resolved'));

create unique index if not exists tracking_validation_issue_transitions_dedup_idx
  on public.tracking_validation_issue_transitions (
    container_id,
    lifecycle_key,
    transition_type,
    state_fingerprint,
    snapshot_id
  );

create index if not exists tracking_validation_issue_transitions_container_idx
  on public.tracking_validation_issue_transitions (container_id, occurred_at desc);

create index if not exists tracking_validation_issue_transitions_process_idx
  on public.tracking_validation_issue_transitions (process_id, occurred_at desc);

create index if not exists tracking_validation_issue_transitions_lifecycle_idx
  on public.tracking_validation_issue_transitions (container_id, lifecycle_key, occurred_at desc);
