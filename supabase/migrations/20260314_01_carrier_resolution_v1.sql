-- 20260314_01_carrier_resolution_v1
-- Carrier Resolution v1: process strategy fields, container assignment metadata,
-- and process-scoped carrier detection run persistence.

alter table public.processes
  add column if not exists carrier_mode text not null default 'AUTO',
  add column if not exists default_carrier_code text null,
  add column if not exists last_resolved_carrier_code text null,
  add column if not exists carrier_resolved_at timestamptz null;

alter table public.processes
  drop constraint if exists processes_carrier_mode_check;
alter table public.processes
  add constraint processes_carrier_mode_check
  check (carrier_mode in ('AUTO', 'MANUAL'));

alter table public.containers
  add column if not exists carrier_assignment_mode text not null default 'AUTO',
  add column if not exists carrier_detected_at timestamptz null,
  add column if not exists carrier_detection_source text null;

alter table public.containers
  drop constraint if exists containers_carrier_assignment_mode_check;
alter table public.containers
  add constraint containers_carrier_assignment_mode_check
  check (carrier_assignment_mode in ('AUTO', 'MANUAL'));

-- Backfill process strategy fields from legacy process.carrier.
update public.processes
set
  carrier_mode = 'MANUAL',
  default_carrier_code = carrier,
  last_resolved_carrier_code = carrier,
  carrier_resolved_at = coalesce(updated_at, created_at, now())
where nullif(btrim(coalesce(carrier, '')), '') is not null;

update public.processes
set
  carrier_mode = 'AUTO',
  default_carrier_code = null,
  last_resolved_carrier_code = null,
  carrier_resolved_at = null
where nullif(btrim(coalesce(carrier, '')), '') is null;

-- Backfill container assignment metadata.
update public.containers
set
  carrier_assignment_mode = 'AUTO',
  carrier_detection_source = coalesce(carrier_detection_source, 'legacy-backfill')
where true;

create table if not exists public.carrier_detection_runs (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  status text not null,
  candidate_providers jsonb not null default '[]'::jsonb,
  attempted_providers jsonb not null default '[]'::jsonb,
  resolved_provider text null,
  confidence text null,
  error_code text null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carrier_detection_runs_status_check
    check (status in ('RUNNING', 'RESOLVED', 'FAILED', 'RATE_LIMITED')),
  constraint carrier_detection_runs_confidence_check
    check (confidence is null or confidence in ('HIGH', 'LOW', 'UNKNOWN'))
);

create index if not exists carrier_detection_runs_process_idx
  on public.carrier_detection_runs(process_id, started_at desc);

create index if not exists carrier_detection_runs_container_idx
  on public.carrier_detection_runs(container_id, started_at desc);

create unique index if not exists carrier_detection_runs_running_unique
  on public.carrier_detection_runs(process_id, container_id)
  where status = 'RUNNING';

create table if not exists public.carrier_detection_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.carrier_detection_runs(id) on delete cascade,
  provider text not null,
  status text not null,
  attempted_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_code text null,
  raw_result_ref text null,
  constraint carrier_detection_attempts_status_check
    check (status in ('FOUND', 'NOT_FOUND', 'ERROR', 'SKIPPED'))
);

create index if not exists carrier_detection_attempts_run_idx
  on public.carrier_detection_attempts(run_id, attempted_at asc);

create or replace function public.touch_carrier_detection_run_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_carrier_detection_runs_updated_at on public.carrier_detection_runs;
create trigger trg_carrier_detection_runs_updated_at
before update on public.carrier_detection_runs
for each row execute function public.touch_carrier_detection_run_updated_at();
