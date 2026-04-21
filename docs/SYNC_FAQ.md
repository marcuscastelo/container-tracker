# Sync FAQ

## Does the site still trigger a simple HTTP request straight to the provider?

Not in active HTTP routes audited here. `POST /api/refresh` and `POST /api/processes/:id/refresh` only enqueue queue work, and legacy direct Maersk route returns `410`. unused direct server fetch use case still exists in tracking code, but no active route/controller call site was found in this audit (`src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`, `src/routes/api/refresh-maersk/[container].ts:1-16`, `src/modules/tracking/application/tracking.usecases.ts:67-90`).

## Is everything queue + agent today?

No. Manual refresh is queue + agent, but `POST /api/processes/sync` and `POST /api/processes/:id/sync` still run synchronous HTTP endpoints that enqueue queue work and then poll `sync_requests` until terminal or timeout (`src/modules/process/interface/http/process.controllers.ts:395-459`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:150-233`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:153-220`).

## What actions trigger sync?

- Process detail manual refresh button: per-container `POST /api/refresh` (`src/modules/process/ui/ShipmentView.tsx:333-356`)
- Dashboard global sync button: `POST /api/processes/sync` (`src/modules/process/ui/api/processSync.api.ts:7-18`, `src/modules/process/ui/components/DashboardRefreshButton.tsx:117-158`)
- Dashboard per-process sync button: `POST /api/processes/:id/sync` (`src/modules/process/ui/api/processSync.api.ts:21-32`, `src/modules/process/ui/components/ProcessSyncButton.tsx:143-160`)
- Agent automatic interval scheduler and realtime wake (`apps/agent/src/agent.scheduler.ts:69-88`, `apps/agent/src/agent.ts:787-831`)

## Where is `sync_requests` written?

Through the RPC `enqueue_sync_request`, called from tracking refresh bootstrap and process bootstrap ports (`src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`, `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95-124`, `supabase/migrations/2026022502_refresh_queue_first.sql:27-117`).

## What statuses exist?

`PENDING`, `LEASED`, `DONE`, `FAILED` in the DB enum; the UI/status APIs also surface `NOT_FOUND` as a synthetic read-state when a requested id is absent (`supabase/migrations/2026022501_agent_sync_mvp.sql:14-40`, `src/modules/tracking/interface/http/refresh.schemas.ts:34-52`, `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:160-190`).

## How does leasing work?

`lease_sync_requests()` claims `PENDING` rows and expired `LEASED` rows with `FOR UPDATE SKIP LOCKED`, sets `leased_by`, sets `leased_until`, and increments `attempts`. Lease validity is rechecked during ingest before marking terminal state (`supabase/migrations/2026022501_agent_sync_mvp.sql:59-98`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-118`).

## Is there a lease heartbeat or renewal?

No confirmed implementation was found. Current recovery is lease expiry and reclaim (`supabase/migrations/2026022501_agent_sync_mvp.sql:80-98`).

## Does the UI use polling, realtime, or both?

Both.

- Realtime: Supabase Postgres changes on `sync_requests`, by ids and container refs (`src/shared/supabase/sync-requests.realtime.ts:151-285`, `src/shared/api/sync-requests.realtime.client.ts:11-35`)
- Polling: `GET /api/refresh/status` watchdog with exponential backoff, plus 10-second detail-page fallback polling when realtime is degraded or container is syncing (`src/modules/process/ui/ShipmentView.tsx:406-515`, `src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`, `src/modules/process/ui/utils/sync-realtime-coordinator.ts:21-199`)

## Does the server poll providers?

No active server-side provider polling flow was found. Provider fetch execution is in agent runtime (`apps/agent/src/agent.ts:656-767`).

## What is "realtime" today exactly?

Supabase Realtime watching `public.sync_requests` via Postgres changes. frontend subscribes by sync request ids or container refs; agent subscribes by tenant id to wake sooner when new `PENDING` work appears (`src/shared/supabase/sync-requests.realtime.ts:151-285`, `apps/agent/src/agent.ts:776-831`).

## What does `GET /api/processes/:id` aggregate?

It aggregates:

- process + containers from process module
- `containersSync` from tracking sync metadata
- per-container tracking summary from tracking module
- server-side timeline read model and operational projections
- alerts and process-level operational rollup

Sources: `src/modules/process/interface/http/process.controllers.ts:236-315`, `src/modules/process/interface/http/process.http.mappers.ts:302-441`, `src/shared/api-schemas/processes.schemas.ts:164-186`.

## Where does composition happen today?

Mostly in process HTTP controller for process detail, and in process application use case for dashboard/process list aggregation. It does not currently live in dedicated capability (`src/modules/process/interface/http/process.controllers.ts:225-315`, `src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:320-389`).

## Does the server and agent share code?

Yes. agent shares provider fetchers and realtime helper from main repo. server and agent do not maintain separate tracking normalization stacks; server remains canonical ingestion/derivation runtime (`apps/agent/src/agent.ts:11-22`, `src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:36-52`, `src/modules/tracking/application/tracking.usecases.ts:62-154`).

## Does the server execute tracking ingestion/derivation?

Yes. In active runtime, agent fetches raw payloads but server persists snapshots and runs tracking pipeline via `/api/tracking/snapshots/ingest` (`apps/agent/src/agent.ts:689-733`, `src/modules/tracking/interface/http/agent-sync.controllers.ts:167-263`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`).

## Where are raw snapshots, observations, timeline, alerts, and sync metadata stored?

- raw snapshots: `container_snapshots` (`src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:13-25`)
- normalized observations: `container_observations` (`src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:14-43`)
- timeline: not persisted; runtime projection (`src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:213-290`)
- alerts: `tracking_alerts` (`src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:18-55`)
- sync metadata: `sync_requests` (`supabase/migrations/2026022501_agent_sync_mvp.sql:18-40`)

## What is deterministic vs monitoring?

- Deterministic: normalize/diff/observation persistence, timeline derivation from observations, status derivation, fact alerts (`src/modules/tracking/application/orchestration/pipeline.ts:80-130`, `src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:225-290`, `src/modules/tracking/features/status/domain/derive/deriveStatus.ts:45-98`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:156-227`)
- Monitoring/now-dependent: expected-event reconciliation and monitoring alerts like `NO_MOVEMENT` (`src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:251-289`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:229-275`)

## Is there backfill?

**UNKNOWN runnable flow.** Backfill flags exist in pipeline and alert rules, but no active backfill trigger was found in sync runtime audited here (`src/modules/tracking/application/orchestration/pipeline.ts:67-75`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:127-275`).

## Is there retry policy, rate limit, DLQ, metrics, or tracing?

- Retry exists only partially:
  - implicit queue retry by lease expiry
  - UI watchdog polling backoff
  - agent enrollment backoff
- Explicit per-job retry policy, provider rate limiter, dead-letter queue, metrics, and tracing were not found in audited sync runtime.

Sources: `supabase/migrations/20260225_01_agent_sync_mvp.sql:80-98`, `src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`, `apps/agent/src/backoff.ts:1-31`, `apps/agent/src/agent.ts:740-855`, `src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts:17-60`, `src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts:10-58`, `src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:277-339`.
