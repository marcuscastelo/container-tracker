# Sync Requests Model

## Purpose

This document describes the operational job model built around `public.sync_requests`.

## Table Contract

`sync_requests` was introduced as the queue table for agent sync. Its current confirmed shape is:

| Field | Meaning |
| --- | --- |
| `id` | job id |
| `tenant_id` | tenant ownership |
| `provider` | `maersk | msc | cmacgm` |
| `ref_type` / `ref_value` | current target key; today only `container` is allowed |
| `status` | `PENDING | LEASED | DONE | FAILED` |
| `priority` | queue ordering input |
| `leased_by` / `leased_until` | current lease holder and TTL |
| `attempts` | increments on every lease |
| `last_error` | last operational error message |
| `created_at` / `updated_at` | operational timestamps |

Sources: `supabase/migrations/2026022501_agent_sync_mvp.sql:18-40`, `src/modules/tracking/interface/http/agent-sync.schemas.ts:47-61`.

## State Model

```text
PENDING
  -> LEASED   via lease_sync_requests()
LEASED
  -> DONE     via markSyncRequestDone()
LEASED
  -> FAILED   via markSyncRequestFailed()
LEASED
  -> LEASED again after expiry, when lease_sync_requests() reclaims expired rows
```

Sources: `supabase/migrations/2026022501_agent_sync_mvp.sql:59-98`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:73-118`.

## Operational Retention Policy (Phase 1)

`sync_requests` now has database-level auto-pruning for terminal rows only.

- retention window: 14 days
- temporal basis: `created_at`
- eligible statuses: `DONE`, `FAILED`
- non-eligible statuses: `PENDING`, `LEASED`
- schedule: daily at `03:30 UTC` via `pg_cron`

Implementation details:

- SQL function: `public.prune_sync_requests() -> integer`
- index for prune path: partial index on `created_at` for terminal statuses

Future evolution (not implemented in this phase):

- evaluate additional terminal statuses like `LEASE_EXPIRED` and `CANCELLED` if/when added to the enum

Sources: `supabase/migrations/2026031002_operational_tables_auto_prune.sql`.

## Where jobs are created

### Confirmed birth points

| Entry point | How job is born |
| --- | --- |
| `pg_cron` provider-paced scheduler | cron `provider-paced-container-sync` executes `enqueue_container_sync_batch()` every 5 minutes, selecting due containers per provider with pacing limits (`supabase/migrations/2026031003_provider_paced_sync_scheduler.sql`, `supabase/migrations/2026031004_provider_paced_sync_scheduler_cron.sql`) |
| `POST /api/refresh` | tracking refresh controller calls `enqueue_sync_request` through bootstrap deps (`src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`) |
| `POST /api/processes/:id/refresh` | process refresh use case iterates process containers and calls the same enqueue port (`src/modules/process/interface/http/process.controllers.ts:463-490`, `src/modules/process/features/process-sync/application/usecases/refresh-process.usecase.ts:116-165`, `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95-124`) |
| `POST /api/processes/:id/sync` | sync use case enqueues targets before waiting on queue status (`src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:180-220`) |
| `POST /api/processes/sync` | same for all active processes (`src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:195-233`) |

### Dedupe behavior

Open requests are deduplicated by a unique partial index on `(tenant_id, provider, ref_type, ref_value)` where status is `PENDING` or `LEASED`. `enqueue_sync_request()` inserts a new `PENDING` row or returns the existing open row with `is_new=false` (`supabase/migrations/2026022502_refresh_queue_first.sql:23-117`).

### Provider-paced scheduler behavior

`enqueue_container_sync_batch()` applies operational pacing and target selection in DB:

- runs with defaults: due window `24h`, recent dedupe window `1h`, limit `10` per provider
- resolves tenant by:
  - unique max active agents (`tracking_agents.revoked_at is null` and `status in ('CONNECTED','DEGRADED')`)
  - fallback to latest tenant seen in `sync_requests`
  - explicit failure when no tenant can be resolved
- selects active containers only (process not archived/deleted, container not removed)
- maps provider from normalized `carrier_code` and keeps only `maersk|msc|cmacgm`
- ranks by oldest `DONE.updated_at` (null first), then `container_number`
- enqueues via `enqueue_sync_request()` (preserving open-row dedupe semantics)

Implementation: `supabase/migrations/2026031003_provider_paced_sync_scheduler.sql`.

## Leasing Model

### Lease acquisition

`lease_sync_requests()`:

- selects `PENDING` rows
- also selects expired `LEASED` rows
- orders by `priority desc, created_at asc`
- uses `FOR UPDATE SKIP LOCKED`
- sets `status='LEASED'`
- sets `leased_by`
- sets `leased_until = now + lease_minutes`
- increments `attempts`

Sources: `supabase/migrations/2026022501_agent_sync_mvp.sql:59-98`.

### Lease TTL

- DB function default lease time: 5 minutes (`supabase/migrations/2026022501_agent_sync_mvp.sql:62-73`)
- server config default `AGENT_LEASE_MINUTES=5` (`src/shared/config/server-env.ts:21-37`)

### Lease validation

The ingest endpoint only accepts work if the row is still:

- `status='LEASED'`
- `leased_by=<agentId>`
- `leased_until > now`

Sources: `src/modules/tracking/interface/http/agent-sync.controllers.ts:185-197`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-71`.

### Heartbeat / renewal

**Not implemented in the audited code.**

No lease heartbeat or renewal endpoint/function was found. The only confirmed recovery path for abandoned work is lease expiry followed by re-leasing (`supabase/migrations/2026022501_agent_sync_mvp.sql:80-98`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-118`).

## Status Writers

### `PENDING`

Set by `enqueue_sync_request()` on insert (`supabase/migrations/2026022502_refresh_queue_first.sql:64-79`).

### `LEASED`

Set by `lease_sync_requests()` when an agent claims work (`supabase/migrations/2026022501_agent_sync_mvp.sql:88-96`).

### `DONE`

Set by `markSyncRequestDone()` after successful `saveAndProcess()` in the ingest flow (`src/modules/tracking/interface/http/agent-sync.controllers.ts:234-263`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:73-95`).

### `FAILED`

Confirmed writers:

- migration cleanup for duplicate open requests during queue-first migration (`supabase/migrations/2026022502_refresh_queue_first.sql:5-21`)
- `markSyncRequestFailed()` in ingest flow for container resolution/validation failures (`src/modules/tracking/interface/http/agent-sync.controllers.ts:211-229`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:97-118`)

### Delayed failure behavior

Most agent scrape/ingest errors are not explicitly marked failed by the agent runtime; the agent logs the error and waits for lease expiration (`tools/agent/agent.ts:735-748`).

## Retry Model

### What exists today

- queue retry by lease expiry and reclaim (`supabase/migrations/2026022501_agent_sync_mvp.sql:80-98`)
- process sync server polling with fixed 5-second interval and 180-second timeout (`src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:3-5`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:113-150`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:4-5`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:110-147`)
- UI refresh status polling with exponential backoff (`src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`)
- agent enrollment/bootstrap retry with exponential backoff + jitter, but this is agent runtime bootstrap reliability, not per-sync job retry (`tools/agent/backoff.ts:1-31`, `tools/agent/agent.ts:535-596`)

### What does not exist today

- no per-provider retry budget persisted in `sync_requests`
- no dead-letter queue
- no "max attempts exceeded" terminal policy
- no explicit retry scheduling field such as `next_attempt_at`

## Dedupe and Idempotency

### Operational dedupe

The queue deduplicates open requests by target/provider while the row is `PENDING` or `LEASED` (`supabase/migrations/2026022502_refresh_queue_first.sql:23-117`).

### Domain idempotency

Tracking facts are still deduplicated independently by observation fingerprint in the pipeline. Even if the same target is retried, observations remain append-only and fingerprint-deduped (`src/modules/tracking/application/orchestration/pipeline.ts:83-100`, `docs/TRACKING_INVARIANTS.md:18-27`, `docs/TRACKING_INVARIANTS.md:56-73`).

## Read Models Derived from `sync_requests`

### Container sync metadata

Tracking sync metadata is read from `sync_requests` and exposed as operational-only data (`src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:23-57`, `src/modules/tracking/application/tracking.usecases.ts:145-154`).

### Process detail

`GET /api/processes/:id` loads `containersSync` from tracking sync metadata and includes it in `ProcessDetailResponse` (`src/modules/process/interface/http/process.controllers.ts:249-257`, `src/modules/process/interface/http/process.http.mappers.ts:433-441`, `src/shared/api-schemas/processes.schemas.ts:154-186`).

### Process list / observability

- dashboard list includes `last_sync_status` and `last_sync_at` derived from sync metadata (`src/modules/process/interface/http/process.http.mappers.ts:155-172`, `src/shared/api-schemas/processes.schemas.ts:31-49`)
- `GET /api/processes/sync-status` exposes a separate observability read model with `syncing/completed/failed` process rollups (`src/modules/process/interface/http/process.controllers.ts:163-186`, `src/routes/api/processes/sync-status.ts:1-3`)

## SLA / SLO / Dead Letter

- SLA/SLO targets were not found in code or docs audited here. Marked **UNKNOWN**.
- Dead-letter routing was not found. Marked **NOT IMPLEMENTED**.
