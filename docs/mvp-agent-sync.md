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
- `AGENT_LEASE_MINUTES` (optional, default `5`)
- `AGENT_ENROLL_DEFAULT_INTERVAL_SEC` (optional, default `60`)
- `AGENT_ENROLL_DEFAULT_LIMIT` (optional, default `10`)
- `AGENT_ENROLL_SUPABASE_URL` (optional)
- `AGENT_ENROLL_SUPABASE_ANON_KEY` (optional)
- `AGENT_ENROLL_DEFAULT_MAERSK_ENABLED` (optional, default `false`)
- `AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS` (optional, default `true`)
- `AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS` (optional, default `120000`)
- `AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR` (optional)
- `AGENT_ENROLL_RATE_LIMIT_MAX_REQUESTS` (optional, default `20`)
- `AGENT_ENROLL_RATE_LIMIT_WINDOW_SEC` (optional, default `60`)

Notes:

- `GET /api/agent/targets` and `POST /api/tracking/snapshots/ingest` authenticate with
  `agent_token` issued by `POST /api/agent/enroll`.
- Agent token is resolved from `tracking_agents` (active/non-revoked row).

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
   - rename `bootstrap.env` -> `bootstrap.env.consumed` with token redacted
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

Headers:

- `Authorization: Bearer <INSTALLER_TOKEN>`

```json
{
  "machineFingerprint": "sha256(machine-guid+hostname)",
  "hostname": "host-123",
  "os": "win32 10.0.19045",
  "agentVersion": "0.1.0"
}
```

Response `200` (example shape):

```json
{
  "agentToken": "runtime-agent-token",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "intervalSec": 60,
  "limit": 10,
  "supabaseUrl": "https://project.supabase.co",
  "supabaseAnonKey": "anon-key",
  "providers": {
    "maerskEnabled": false,
    "maerskHeadless": true,
    "maerskTimeoutMs": 120000
  }
}
```

Rules:

- `INSTALLER_TOKEN` must be revocable/rotatable.
- Response may omit Supabase keys; agent must continue with polling.
- Response never includes installer secret.
- Logs must never print `INSTALLER_TOKEN` or `AGENT_TOKEN`.

## 4) Database Migration

Apply:

- `supabase/migrations/20260225_01_agent_sync_mvp.sql`
- `supabase/migrations/20260225_02_refresh_queue_first.sql`
- `supabase/migrations/20260226_01_agent_runtime_enrolment.sql`

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
- request `tenant_id` must match the tenant attached to bearer `agentToken` (`403` on mismatch)
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
- payload `tenant_id` must match bearer `agentToken` tenant (`403` on mismatch)
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
- `409 lease_conflict`: lease expired or taken by another agent.
- `422` container resolve failure: request marked `FAILED` with `last_error`.
- Realtime unavailable: polling mode continues.
