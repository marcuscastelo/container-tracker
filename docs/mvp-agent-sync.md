# MVP Agent Sync (Supabase + SolidStart)

## Overview

This MVP introduces:

- Queue table: `sync_requests`
- Atomic lease RPC: `lease_sync_requests(...)`
- Atomic enqueue RPC: `enqueue_sync_request(...)`
- API routes:
  - `POST /api/refresh` (queue-first, no backend scraping)
  - `GET /api/agent/targets`
  - `POST /api/tracking/snapshots/ingest`
- Legacy route:
  - `GET/POST /api/refresh-maersk/:container` now returns `410 Gone`
- Local Node agent runner: `tools/agent/agent.ts`

Snapshots continue to be persisted in existing `container_snapshots` via
`trackingUseCases.saveAndProcess(...)`.

## 1) Environment Variables

### Backend (Vercel / server runtime)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SYNC_DEFAULT_TENANT_ID` (required; UUID used by `/api/refresh` enqueue)
- `AGENT_TOKEN` (required in production)
- `AGENT_LEASE_MINUTES` (optional, default `5`)

Notes:

- If `AGENT_TOKEN` is missing and `NODE_ENV !== production`, auth is bypassed.
- If `AGENT_TOKEN` is missing and `NODE_ENV === production`, requests are rejected.

### Agent

- `BACKEND_URL` (example: `https://your-app.vercel.app`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
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

- [20260225_01_agent_sync_mvp.sql](supabase/migrations/20260225_01_agent_sync_mvp.sql)
- [20260225_02_refresh_queue_first.sql](supabase/migrations/20260225_02_refresh_queue_first.sql)

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

### 4.1 Enqueue from UI-style refresh

```bash
curl -i \
  -X POST "$BACKEND_URL/api/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "container":"MSCU1234567",
    "carrier":"msc"
  }'
```

Expected:

- HTTP `202`
- response contains `syncRequestId`, `queued: true`, `deduped: <bool>`
- repeated calls while request is `PENDING/LEASED` reuse the same open request (`deduped: true`)

### 4.2 Verify deprecated legacy route

```bash
curl -i \
  "$BACKEND_URL/api/refresh-maersk/MSCU1234567"
```

Expected:

- HTTP `410`
- `{ "error": "refresh_maersk_deprecated_use_sync_queue" }`

### 4.3 Lease targets

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

### 4.4 Ingest snapshot

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

Runtime mode is now hybrid:

1. startup cycle runs immediately
2. Realtime wake on `sync_requests` (`PENDING` events by tenant)
3. periodic interval sweep remains active (`INTERVAL_SEC`) for resilience
4. each cycle executes `GET /api/agent/targets` -> scrape -> `POST /api/tracking/snapshots/ingest`

## 6) UI Wait Mode

- UI refresh wait is `realtime-first`.
- `GET /api/refresh/status` remains as watchdog/backoff fallback (`5, 10, 20, 40, 80s`).
- While waiting on realtime, UI shows `shipmentView.refreshSyncing`.
- When watchdog retries run, UI shows `retry X/N`.

## 7) Troubleshooting

- `401 Unauthorized`: check `AGENT_TOKEN` header.
- `500 AGENT_TOKEN is required in production`: set backend `AGENT_TOKEN`.
- `500` on `/api/refresh` with env error: set `SYNC_DEFAULT_TENANT_ID`.
- `409 lease_conflict`: lease expired or was taken/released by another agent.
- `422 No container found / Ambiguous container`: request is marked `FAILED` with `last_error`.
- Realtime unavailable: UI fallback polling and agent interval sweep continue.
- No realtime events in agent: validate Supabase realtime is enabled on `public.sync_requests` and anon key can subscribe.
