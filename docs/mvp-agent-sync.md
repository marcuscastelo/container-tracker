# MVP Agent Sync (Supabase + SolidStart)

## Overview

This MVP introduces:

- Queue table: `sync_requests`
- Atomic lease RPC: `lease_sync_requests(...)`
- API routes:
  - `GET /api/agent/targets`
  - `POST /api/tracking/snapshots/ingest`
- Local Node agent runner: `tools/agent/agent.ts`

Snapshots continue to be persisted in existing `container_snapshots` via
`trackingUseCases.saveAndProcess(...)`.

## 1) Environment Variables

### Backend (Vercel / server runtime)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_TOKEN` (required in production)
- `AGENT_LEASE_MINUTES` (optional, default `5`)

Notes:

- If `AGENT_TOKEN` is missing and `NODE_ENV !== production`, auth is bypassed.
- If `AGENT_TOKEN` is missing and `NODE_ENV === production`, requests are rejected.

### Agent

- `BACKEND_URL` (example: `https://your-app.vercel.app`)
- `TENANT_ID` (UUID)
- `AGENT_TOKEN` (must match backend in production)
- `AGENT_ID` (optional; default hostname)
- `INTERVAL_SEC` (optional; default `60`)
- `LIMIT` (optional; default `10`)
- `MAERSK_HEADLESS` (optional; default `true`)
- `MAERSK_TIMEOUT_MS` (optional; default `120000`)
- `MAERSK_USER_DATA_DIR` (optional)

## 2) Database Migration

Apply:

- [20260225_01_agent_sync_mvp.sql](/home/marucs/Development/Castro/container-tracker/supabase/migrations/20260225_01_agent_sync_mvp.sql)

If you use Supabase SQL Editor, paste and run the full migration file.

## 3) Seed a Pending Sync Request

```sql
insert into public.sync_requests (
  tenant_id,
  provider,
  ref_type,
  ref_value,
  status,
  priority
) values (
  '11111111-1111-4111-8111-111111111111',
  'msc',
  'container',
  'MSCU1234567',
  'PENDING',
  10
);
```

## 4) API Smoke Tests

### 4.1 Lease targets

```bash
curl -i \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "x-agent-id: local-agent-1" \
  "$BACKEND_URL/api/agent/targets?tenant_id=$TENANT_ID&limit=5"
```

Expected:

- HTTP `200`
- `targets[]` list
- leased rows become `status=LEASED`

### 4.2 Ingest snapshot

```bash
curl -i \
  -X POST "$BACKEND_URL/api/tracking/snapshots/ingest" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "x-agent-id: local-agent-1" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id":"'"$TENANT_ID"'",
    "provider":"msc",
    "ref":{"type":"container","value":"MSCU1234567"},
    "observed_at":"2026-02-25T10:00:00.000Z",
    "raw":{"source":"manual-smoke"},
    "meta":{"agent_version":"mvp-0.1","host":"local-agent-1"},
    "sync_request_id":"<SYNC_REQUEST_UUID>"
  }'
```

Expected:

- HTTP `202` with `snapshot_id`
- `sync_requests.status` transitions to `DONE`
- snapshot persisted in `container_snapshots`

## 5) Run Agent

```bash
node --experimental-strip-types tools/agent/agent.ts
```

The loop executes:

1. `GET /api/agent/targets`
2. scrape by provider (`maersk` / `msc` / `cmacgm`)
3. `POST /api/tracking/snapshots/ingest`
4. sleep and repeat

## 6) Troubleshooting

- `401 Unauthorized`: check `AGENT_TOKEN` header.
- `500 AGENT_TOKEN is required in production`: set backend `AGENT_TOKEN`.
- `409 lease_conflict`: lease expired or was taken/released by another agent.
- `422 No container found / Ambiguous container`: request is marked `FAILED` with `last_error`.
