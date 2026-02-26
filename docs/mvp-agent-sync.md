# MVP Agent Sync (One-Click Runtime Enrolment)

## Overview

This document defines the operational model for one-click Agent install + runtime bootstrap.

Core components:

- Queue table: `sync_requests`
- Atomic lease RPC: `lease_sync_requests(...)`
- Atomic enqueue RPC: `enqueue_sync_request(...)`
- API routes:
  - `POST /api/refresh` (queue-first, no backend scraping)
  - `GET /api/agent/targets`
  - `POST /api/tracking/snapshots/ingest`
  - `POST /api/agent/enroll` (bootstrap -> effective config contract)
- Legacy route:
  - `GET/POST /api/refresh-maersk/:container` returns `410 Gone`
- Local Node runner: `tools/agent/agent.ts`

Snapshots continue to be persisted in `container_snapshots` via
`trackingUseCases.saveAndProcess(...)`.

## 1) Environment Model

### 1.1 Backend (server runtime)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SYNC_DEFAULT_TENANT_ID` (required; UUID used by `/api/refresh` enqueue)
- `AGENT_TOKEN` (required in production for agent API auth)
- `AGENT_LEASE_MINUTES` (optional, default `5`)

Notes:

- If `AGENT_TOKEN` is missing and `NODE_ENV !== production`, auth may be bypassed.
- If `AGENT_TOKEN` is missing and `NODE_ENV === production`, requests are rejected.

### 1.2 Agent bootstrap input (`bootstrap.env`)

`bootstrap.env` is installed into ProgramData by installer and is the primary first-run input:

- `BACKEND_URL` (required)
- `INSTALLER_TOKEN` (required bootstrap secret)
- optional runtime defaults such as:
  - `AGENT_ID`
  - `INTERVAL_SEC`
  - `LIMIT`
  - `MAERSK_ENABLED`
  - `MAERSK_HEADLESS`
  - `MAERSK_TIMEOUT_MS`
  - `MAERSK_USER_DATA_DIR`

No user manual edit is required in primary flow.

### 1.3 Effective runtime config (`config.env`)

`config.env` is issued by backend enrolment and persisted in ProgramData.
Expected keys include:

- `BACKEND_URL`
- `TENANT_ID`
- `AGENT_TOKEN`
- optional:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - runtime defaults (`AGENT_ID`, `INTERVAL_SEC`, `LIMIT`, `MAERSK_*`)

Supabase remains optional:

- if `SUPABASE_URL` + `SUPABASE_ANON_KEY` are present, realtime wake is enabled
- if absent, agent runs polling-only mode

## 2) Runtime Startup Modes

At service startup:

1. If `config.env` exists and parses: normal mode.
2. If missing or invalid: bootstrap mode.

Bootstrap mode behavior:

1. Read `bootstrap.env`.
2. Call `POST /api/agent/enroll` with `INSTALLER_TOKEN`.
3. On success:
   - persist returned `config.env`
   - optionally rename/delete `bootstrap.env`
   - switch to normal mode
4. On failure:
   - do not crash process
   - log sanitized error
   - retry with backoff

Default retry profile:

- base delay: `5s`
- factor: `2`
- cap: `300s`
- jitter: `20%`
- retries: indefinite until success

## 3) Enrolment API Contract

### 3.1 `POST /api/agent/enroll`

Purpose: exchange bootstrap secret for effective runtime config.

Request body (minimum):

```json
{
  "installer_token": "<INSTALLER_TOKEN>",
  "agent_id": "optional-host-or-agent-id",
  "host": "optional-hostname"
}
```

Response `200` (example shape):

```json
{
  "config_env": "BACKEND_URL=...\nTENANT_ID=...\nAGENT_TOKEN=...\nINTERVAL_SEC=60\nLIMIT=10\n"
}
```

Rules:

- `INSTALLER_TOKEN` must be revocable/rotatable.
- Response may omit Supabase keys; agent must continue with polling.
- Logs must never print `INSTALLER_TOKEN` or `AGENT_TOKEN`.

## 4) Database Migration

Apply:

- `supabase/migrations/20260225_01_agent_sync_mvp.sql`
- `supabase/migrations/20260225_02_refresh_queue_first.sql`

## 5) API Smoke Tests

### 5.1 Enqueue from UI-style refresh

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
- repeated calls while request is `PENDING/LEASED` reuse same open request

### 5.2 Lease targets

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

### 5.3 Ingest snapshot

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

## 6) Run Agent

```bash
node --experimental-strip-types tools/agent/agent.ts
```

First execution:

1. resolve mode (`normal` or `bootstrap`)
2. if bootstrap, enrol with retry/backoff until config is obtained
3. run normal cycle

Normal cycle:

1. startup run immediately
2. realtime wake on `sync_requests` when Supabase realtime config exists
3. interval sweep always active (`INTERVAL_SEC`)
4. each cycle: `GET /api/agent/targets` -> scrape -> `POST /api/tracking/snapshots/ingest`

## 7) UI Wait Mode

- UI refresh wait is realtime-first.
- `GET /api/refresh/status` remains fallback watchdog/backoff (`5, 10, 20, 40, 80s`).
- While waiting on realtime, UI shows `shipmentView.refreshSyncing`.
- Watchdog retries show `retry X/N`.

## 8) Troubleshooting

- No internet: enrolment retries forever with exponential backoff.
- `401 Unauthorized` on enrolment: bootstrap token invalid/revoked; process stays alive.
- `5xx` on enrolment: backend unavailable; process retries with cap+jitter.
- `500 AGENT_TOKEN is required in production`: backend config issue.
- `409 lease_conflict`: lease expired or taken by another agent.
- `422` container resolve failure: request marked `FAILED` with `last_error`.
- Realtime unavailable: polling mode continues.
