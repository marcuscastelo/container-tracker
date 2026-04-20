-- 20260407_01_add_process_depositary
-- Adds the canonical process depositary metadata field.

alter table if exists public.processes
add column if not exists depositary text;
