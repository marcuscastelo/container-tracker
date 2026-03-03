-- Preserve original carrier labels for audit-friendly unknown event rendering.
ALTER TABLE IF EXISTS public.container_observations
ADD COLUMN IF NOT EXISTS carrier_label text;
