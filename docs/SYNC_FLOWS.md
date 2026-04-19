# Sync Flows

## Scope

This document maps current end-to-end sync scenarios with code evidence. It intentionally separates confirmed current behavior from `UNKNOWN` behavior.

## Scenario 1: User opens Process Detail

### Sequence

```text
UI ShipmentView
  -> fetchProcess("/api/processes/:id")
  -> process controller getProcessById
  -> processUseCases.findProcessByIdWithContainers
  -> trackingUseCases.getContainersSyncMetadata
  -> trackingUseCases.getContainerSummary per container
  -> deriveTimelineWithSeriesReadModel
  -> toProcessDetailResponse
  -> UI maps DTO -> ShipmentDetailVM
  -> UI subscribes to sync_requests by container refs
  -> UI enables 10s fallback polling only if realtime is degraded or any container is syncing
```

### What actually happens

1. route `GET /api/processes/:id` is thin adapter to `processControllers.getProcessById` (`src/routes/api/processes/[id]/index.ts:1-5`).
2. `getProcessById()` loads process + containers, then loads container sync metadata from `trackingUseCases.getContainersSyncMetadata()`, then loads per-container tracking summary, derives timeline read model, and maps final HTTP DTO (`src/modules/process/interface/http/process.controllers.ts:225-315`).
3. HTTP mapper adds container operational projection, `containersSync`, alerts, and process-level operational fields into `ProcessDetailResponse` (`src/modules/process/interface/http/process.http.mappers.ts:286-441`, `src/shared/api-schemas/processes.schemas.ts:154-186`).
4. UI converts HTTP DTO to `ShipmentDetailVM`; it does formatting, VM assembly, and sync badge mapping, but it does not derive tracking truth (`src/modules/process/ui/mappers/processDetail.ui-mapper.ts:172-255`, `docs/BOUNDARIES.md:67-80`, `docs/TYPE_ARCHITECTURE.md:24-43`).
5. While detail page is open, `useSyncRealtimeCoordinator()` subscribes to realtime by container refs and triggers tracking-only refetch; if realtime is degraded or page already shows syncing containers, it falls back to 10-second poll while page is visible (`src/modules/process/ui/utils/sync-realtime-coordinator.ts:21-199`).

## Scenario 2: User clicks refresh on Process Detail

### Sequence

```text
ShipmentView refresh button
  -> POST /api/refresh (one request per container)
  -> enqueue_sync_request
  -> UI subscribes to sync_requests by ids
  -> UI bootstraps status via GET /api/refresh/status
  -> UI starts exponential-backoff watchdog polling
  -> agent wakes by tenant realtime or interval scheduler
  -> GET /api/agent/targets
  -> agent scrapes provider
  -> POST /api/tracking/snapshots/ingest
  -> server saveAndProcess pipeline
  -> server marks sync_requests DONE/FAILED
  -> realtime/polling sees terminal state
  -> UI refreshes tracking-only data
```

### What actually happens

1. `ShipmentView` still calls `/api/refresh` per container, not `/api/processes/:id/refresh` (`src/modules/process/ui/ShipmentView.tsx:333-356`).
2. `POST /api/refresh` only validates and enqueues through `refreshRestUseCase` and `enqueue_sync_request`; it does not scrape any provider (`src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts:49-80`, `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`).
3. detail view then:
   - subscribes to realtime by `syncRequestId`
   - bootstraps current queue state with `GET /api/refresh/status`
   - runs `pollRefreshSyncStatus()` watchdog with `maxRetries=5` and `initialDelayMs=5000`
(`src/modules/process/ui/ShipmentView.tsx:39-40`, `src/modules/process/ui/ShipmentView.tsx:406-515`, `src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`).
4. agent is woken either by its interval scheduler or by tenant-level realtime on `sync_requests` rows that become `PENDING` (`apps/agent/src/agent.scheduler.ts:18-89`, `apps/agent/src/agent.ts:776-831`).
5. agent leases targets via `GET /api/agent/targets`, scrapes provider, and posts raw payload to `POST /api/tracking/snapshots/ingest` (`apps/agent/src/agent.ts:630-733`).
6. server validates lease, resolves container, calls `trackingUseCases.saveAndProcess()`, then marks request `DONE`; container resolution failures are marked `FAILED` (`src/modules/tracking/interface/http/agent-sync.controllers.ts:185-263`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-144`).

## Scenario 2B: User clicks refresh on Dashboard / process row

### Dashboard global refresh

```text
Dashboard button
  -> POST /api/processes/sync
  -> enqueue sync requests for all active processes
  -> server polls sync_requests until terminal or timeout
  -> UI refetches /api/processes and /api/dashboard/operational-summary
```

Sources: `src/modules/process/ui/components/DashboardRefreshButton.tsx:60-158`, `src/modules/process/ui/utils/dashboard-refresh.ts:16-35`, `src/modules/process/ui/api/processSync.api.ts:7-18`, `src/modules/process/interface/http/process.controllers.ts:395-421`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:150-233`.

### Dashboard per-process sync

```text
ProcessSyncButton
  -> POST /api/processes/:id/sync
  -> enqueue sync requests for that process
  -> server polls sync_requests until terminal or timeout
  -> UI shows local + realtime-derived sync state
```

Sources: `src/modules/process/ui/components/ProcessSyncButton.tsx:118-178`, `src/modules/process/ui/api/processSync.api.ts:21-32`, `src/modules/process/interface/http/process.controllers.ts:424-459`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:153-220`, `src/modules/process/ui/hooks/useProcessSyncRealtime.ts:115-197`.

## Scenario 3: Automatic sync

### Sequence

```text
agent start
  -> load runtime config or enroll with bootstrap token
  -> start scheduler
  -> run startup cycle
  -> every INTERVAL_SEC run another cycle
  -> if Supabase realtime is configured, wake immediately on tenant sync_requests PENDING
  -> each cycle leases targets, scrapes provider, ingests payload
```

### What actually happens

1. agent can self-enroll using `POST /api/agent/enroll` and persists/updates its runtime config locally after successful enrollment (`apps/agent/src/agent.ts:535-596`, `src/routes/api/agent/enroll.ts:1-13`, `src/modules/tracking/interface/http/agent-enroll.controllers.ts:207-321`).
2. scheduler fires on startup and every configured interval (`apps/agent/src/agent.scheduler.ts:69-88`).
3. Realtime wake is optional. If `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing, agent keeps only interval sweep (`apps/agent/src/agent.ts:787-837`).
4. cycle currently processes one leased target at time until `LIMIT` is reached (`apps/agent/src/agent.ts:751-774`).

### What was not found

- No server-side cron that fetches providers directly.
- No webhook-initiated sync flow.
- No separate worker queue besides `sync_requests`.

These absences are audit results; no matching runtime entrypoints were found in repository during this audit.

## Scenario 4: Failure and retry

### Queue/lease path

```text
agent leases request
  -> scrape or ingest fails
  -> request usually stays LEASED until leased_until expires
  -> lease_sync_requests can pick expired LEASED rows again
  -> attempts increments on every new lease
```

### Confirmed behavior

1. `lease_sync_requests()` can lease both `PENDING` rows and expired `LEASED` rows, and increments `attempts` when it does so (`supabase/migrations/20260225_01_agent_sync_mvp.sql:59-98`).
2. agent currently logs most target failures and explicitly says target will be available again after lease expiration; it does not call dedicated "fail this target now" endpoint (`apps/agent/src/agent.ts:735-748`).
3. Immediate `FAILED` state is only confirmed on server ingest path for container-resolution problems and similar validated failures (`src/modules/tracking/interface/http/agent-sync.controllers.ts:211-229`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:97-118`).
4. synchronous process sync endpoints time out after 180 seconds with fixed 5-second polling (`src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:3-5`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:113-150`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:4-5`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:110-147`).
5. detail refresh watchdog uses exponential backoff in UI: 5s, 10s, 20s, 40s, 80s for default five retries (`src/modules/process/ui/ShipmentView.tsx:39-40`, `src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`).

### Operational meaning

- Retry today is lease-expiry retry, not explicit retry policy with per-provider backoff persisted in job model.
- There is no dead-letter queue or explicit triage bucket for exhausted jobs in audited code.

## Scenario 5: Backfill

### Current answer

**UNKNOWN executable flow.**

tracking pipeline and alert derivation support `isBackfill` flag, and fact alerts become retroactive while monitoring alerts are suppressed during backfill. But no active endpoint, CLI command, scheduler, or job type that sets `isBackfill=true` was found in sync runtime path audited here (`src/modules/tracking/application/orchestration/pipeline.ts:67-75`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:127-275`).

### Where to look next

- future backfill command in `apps/agent/src/*`
- future HTTP/admin endpoint under `src/routes/api/*`
- migrations adding dedicated backfill job type to `sync_requests`

## End-to-End Tracking Pipeline

```text
sync_requests enqueue
  -> lease_sync_requests
  -> provider fetch
  -> raw snapshot persisted in container_snapshots
  -> snapshot normalized into observation drafts
  -> new fingerprints diffed and inserted into container_observations
  -> timeline derived from all observations
  -> status derived from timeline
  -> alerts derived from timeline + status + existing active alerts
  -> new alerts inserted into tracking_alerts
  -> GET /api/processes/:id composes DTO
  -> UI maps DTO -> VM
```

Sources: `supabase/migrations/2026022502_refresh_queue_first.sql:27-117`, `supabase/migrations/2026022501_agent_sync_mvp.sql:59-98`, `src/modules/tracking/application/usecases/save-and-process.usecase.ts:35-60`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`, `src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:13-25`, `src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:14-43`, `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:18-55`, `src/modules/process/interface/http/process.controllers.ts:236-315`, `src/modules/process/ui/mappers/processDetail.ui-mapper.ts:172-255`.
