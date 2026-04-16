-- 20260402_03_backfill_container_carriers_from_processes
-- Keeps container carrier identity aligned with the owning process carrier for active records.

update public.containers as c
set carrier_code = p.carrier
from public.processes as p
where p.id = c.process_id
  and p.deleted_at is null
  and p.archived_at is null
  and c.removed_at is null
  and p.carrier is not null
  and c.carrier_code is distinct from p.carrier;
