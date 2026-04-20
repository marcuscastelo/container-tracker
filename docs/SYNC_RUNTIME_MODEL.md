# Sync Runtime Model

## Server vs Agent

|Runtime|What it does today|What it does not do today|
| --- | --- | --- |
|HTTP server|exposes enqueue/status/lease/ingest/read-model endpoints; authenticates agents; runs `saveAndProcess()` and deterministic tracking pipeline; maps DTOs for UI (`src/routes/api/refresh.ts:8-15`, `src/routes/api/agent/targets.ts:1-13`, `src/routes/api/tracking/snapshots/ingest.ts:1-13`, `src/modules/tracking/interface/http/agent-sync.controllers.ts:123-263`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`, `src/modules/process/interface/http/process.controllers.ts:225-315`)|no active provider scheduler/cron; no active direct Maersk route; no confirmed webhook receiver (`src/routes/api/refresh-maersk/[container].ts:1-16`)|
|agent|enrolls, schedules cycles, leases queue work, fetches provider payloads, posts raw payload back to server, subscribes to tenant realtime wake when configured (`apps/agent/src/agent.ts:535-866`, `apps/agent/src/agent.scheduler.ts:18-89`)|does not run normalize/diff/timeline/status/alerts locally; does not write snapshots/observations/alerts directly to DB|

## Shared Code Between Server and Agent

### Confirmed shared code

- agent imports provider fetchers from `src/modules/tracking/infrastructure/carriers/fetchers/*` (`apps/agent/src/agent.ts:11-18`).
- agent imports shared realtime subscription helper from `src/shared/supabase/sync-requests.realtime.ts` (`apps/agent/src/agent.ts:18`, `src/shared/supabase/sync-requests.realtime.ts:151-285`).
- server bootstraps tracking use case facade from shared tracking repositories and pipeline code (`src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:36-52`, `src/modules/tracking/application/tracking.usecases.ts:62-154`).

### Boundary interpretation

This means there is no parallel "tracking brain" in agent. agent shares infra fetch helpers, but canonical normalization and derivation still live in tracking BC on server. That is aligned with "tracking owns ingestion snapshot, normalization, and deterministic derivation" (`docs/BOUNDARIES.md:7-45`, `docs/TRACKING_INVARIANTS.md:7-39`, `docs/TRACKING_EVENT_SERIES.md:113-126`).

## Polling vs Realtime

## UI polling

### Detail refresh watchdog polling

- `ShipmentView` bootstraps status from `GET /api/refresh/status` after enqueueing container refreshes (`src/modules/process/ui/ShipmentView.tsx:333-385`, `src/modules/tracking/interface/http/refresh.controllers.ts:76-108`).
- If realtime does not reach terminal state first, UI runs `pollRefreshSyncStatus()` with exponential backoff and default settings `maxRetries=5`, `initialDelayMs=5000` (`src/modules/process/ui/ShipmentView.tsx:39-40`, `src/modules/process/ui/ShipmentView.tsx:467-483`, `src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`).

### Detail auto-refresh fallback polling

- While detail page stays open, `useSyncRealtimeCoordinator()` enables 10-second fallback polling only when page is visible and either realtime is degraded or any container already shows syncing state (`src/modules/process/ui/utils/sync-realtime-coordinator.ts:21-28`, `src/modules/process/ui/utils/sync-realtime-coordinator.ts:164-199`).

### Dashboard polling

- Dashboard sync is not long-lived client polling. user action hits synchronous server endpoints (`/api/processes/sync` or `/api/processes/:id/sync`), and UI refetches list/alerts after server call returns (`src/modules/process/ui/api/processSync.api.ts:7-32`, `src/modules/process/ui/utils/dashboard-refresh.ts:16-35`).

## Server polling

- No active server loop that polls providers was found in current HTTP runtime.
- only server-side polling found in sync path is queue-status polling inside synchronous process sync use cases, where server repeatedly checks `sync_requests` until all terminal or timeout (`src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:110-147`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:113-150`).

## Realtime today

### Transport

Realtime is Supabase Postgres changes on `public.sync_requests`, implemented through shared realtime helper and frontend/client wrappers (`src/shared/supabase/sync-requests.realtime.ts:45-285`, `src/shared/api/sync-requests.realtime.client.ts:1-35`). No SSE, native WebSocket endpoint, or webhook-based sync entrypoint was identified in audited sync runtime.

### Subscription scopes

- by `syncRequestId` for manual refresh waiting (`src/shared/api/sync-requests.realtime.client.ts:11-22`, `src/modules/process/ui/ShipmentView.tsx:436-455`)
- by `ref_type=container` + `ref_value` for process detail auto-refresh and dashboard row state (`src/shared/supabase/sync-requests.realtime.ts:229-262`, `src/modules/process/ui/utils/sync-realtime-coordinator.ts:115-162`, `src/modules/process/ui/hooks/useProcessSyncRealtime.ts:115-197`)
- by `tenant_id` for agent wake-up (`src/shared/supabase/sync-requests.realtime.ts:264-285`, `apps/agent/src/agent.ts:787-831`)

### What triggers UI updates

- Detail refresh modal/waiting state reacts to realtime `sync_requests` events and resolves when all tracked ids are terminal (`src/modules/process/ui/ShipmentView.tsx:406-515`).
- Detail page automatic tracking refresh reacts to any `sync_requests` event tied to tracked container number and schedules `refreshTrackingData()` (`src/modules/process/ui/utils/sync-realtime-coordinator.ts:135-153`).
- Dashboard sync badges derive ephemeral process sync state from per-container realtime status (`src/modules/process/ui/hooks/useProcessSyncRealtime.ts:52-76`, `src/modules/process/ui/hooks/useProcessSyncRealtime.ts:154-177`).

## Read Model Runtime

### Process detail

`GET /api/processes/:id` is server-side composition, not client-side truth derivation. It reads:

- process + containers from process BC
- container sync metadata from tracking sync metadata repository
- container tracking summary from tracking BC
- timeline read model derived on server

and then maps to `ProcessDetailResponse` (`src/modules/process/interface/http/process.controllers.ts:236-315`, `src/modules/process/interface/http/process.http.mappers.ts:388-441`, `src/shared/api-schemas/processes.schemas.ts:164-186`).

### Process list/dashboard

`listProcessesWithOperationalSummary()` lives in process application and aggregates process/container data with tracking summaries and sync metadata (`src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:320-389`).

## Caching

### Confirmed cache behavior

- No server ETag handling was found.
- No stale-while-revalidate response strategy was found.
- `GET /api/refresh/status` and `GET /api/processes/sync-status` explicitly disable caching via `Cache-Control: no-store` (`src/modules/tracking/interface/http/refresh.controllers.ts:95-108`, `src/modules/process/interface/http/process.controllers.ts:166-182`).
- UI uses in-memory TTL caches:
  - process detail prefetch cache: 15 seconds (`src/modules/process/ui/fetchProcess.ts:6-55`)
  - dashboard processes/global alerts cache: 15 seconds (`src/modules/process/ui/validation/processApi.validation.ts:21-195`)

### Interpretation

Current cache behavior is client-memory convenience caching only. It is not canonical sync/read-model cache protocol.

## Deterministic vs Monitoring Logic

- deterministic/pure derivation:
  - timeline from full observation history (`src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:225-290`)
  - status from timeline, ACTUAL-first monotonic rules (`src/modules/tracking/features/status/domain/derive/deriveStatus.ts:21-98`)
  - fact alerts from timeline + status + existing active alerts (`src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:156-227`)
- monitoring/`now`-dependent logic:
  - timeline reconciliation of expected events depends on `now` (`src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:225-253`)
  - monitoring alerts such `NO_MOVEMENT` depend on current time and are suppressed during backfill (`src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:229-275`)

This matches policy that fact alerts can be retroactive while monitoring alerts must not be retroactive (`docs/ALERT_POLICY.md:24-84`).
