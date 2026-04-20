# Access Model V1 (Multi-Tenant + RLS)

This document records V1 implementation for tenancy and access control.

## Implemented schema

- `public.platform_tenants`
- `public.users` (internal authorization identity, mapped from WorkOS identity)
- `public.tenant_role_definitions`
- `public.tenant_memberships`
- `public.importers`
- `public.membership_importer_access`

## Dual-column transition

V1 keeps legacy `tenant_id` while introducing `platform_tenant_id`:

- existing `tenant_id` tables got `platform_tenant_id`
- sync trigger keeps columns aligned where both exist
- constraints enforce equality (`tenant_id = platform_tenant_id`)

## Importer scope

`importer_id` added to tenant-scoped operational tables:

- `processes`
- `containers`
- `container_snapshots`
- `container_observations`
- `tracking_alerts`

Backfill and propagation triggers derive importer scope through process/container relations.

## RLS model

RLS helper functions in `private` schema:

- `private.has_active_membership(uuid)`
- `private.is_tenant_admin(uuid)`
- `private.has_importer_access(uuid, uuid)`
- `private.can_access_row(uuid, uuid)`

Policy behavior:

- `ADMIN`: full access inside own tenant.
- `IMPORTER`: access only when row has explicit authorized `importer_id`.
- deny-by-default when no active membership.

## WorkOS → internal auth bridge

New HTTP endpoint:

- `POST /api/access/bridge-session`

Behavior:

1. resolve/upsert `public.users` by `workos_user_id`
2. verify active membership when `platform_tenant_id` provided
3. issue Supabase-compatible JWT (`role=authenticated`, `sub=users.id`)

Required env for token issuance:

- `SUPABASE_JWT_SECRET`

## Access admin endpoints

- `GET /api/access/overview`
- `POST /api/access/tenants`
- `POST /api/access/importers`
- `POST /api/access/memberships`
- `POST /api/access/bridge-session`

## Minimal admin UI

- Route: `/access`
- Screen: manage tenants, importers, memberships, and importer scope links.
