-- Local seed intentionally minimal and deterministic.
-- Keeps runtime enrollment usable after `supabase db reset` in local-only workflow.

insert into public.agent_install_tokens (
  tenant_id,
  token_hash,
  description,
  revoked_at,
  expires_at
)
values (
  '1196930b-d856-4960-8bb1-cc44ea64afb8',
  'f7107140950001b7a37d802fb0da0c0ae44d5bb44cd84283757638f3c4dd7734',
  'local-dev bootstrap installer token',
  null,
  null
)
on conflict (token_hash) do update
set
  revoked_at = excluded.revoked_at,
  expires_at = excluded.expires_at,
  updated_at = now();
