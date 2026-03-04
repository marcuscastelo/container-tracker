alter table public.processes
  add column if not exists operational_workflow_state text not null default 'WAITING_BL';
