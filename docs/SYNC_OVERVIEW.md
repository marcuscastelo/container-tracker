# Sync Overview

## Purpose

This docset is current source of truth for sync in Container Tracker. It covers HTTP server, `sync_requests`, agent runtime, UI polling/realtime, and tracking ingestion pipeline. It should be read together with canonical boundary/type/tracking docs: `docs/BOUNDARIES.md`, `docs/TYPE_ARCHITECTURE.md`, `docs/TRACKING_INVARIANTS.md`, `docs/TRACKING_EVENT_SERIES.md`, `docs/ALERT_POLICY.md`, and `docs/ARCHITECTURE.md` (`docs/BOUNDARIES.md:1-116`, `docs/TYPE_ARCHITECTURE.md:20-180`, `docs/TRACKING_INVARIANTS.md:7-73`, `docs/TRACKING_EVENT_SERIES.md:23-126`, `docs/ALERT_POLICY.md:24-84`, `docs/ARCHITECTURE.md:21-188`).

## Executive Snapshot

- Sync is not "all queue + agent" yet. current system has two active paradigms:
  - queue-first async refresh (`POST /api/refresh`, `POST /api/processes/:id/refresh`)
  - synchronous HTTP endpoints that enqueue and then block waiting for terminal queue states (`POST /api/processes/sync`, `POST /api/processes/:id/sync`) (`src/routes/api/refresh.ts:8-15`, `src/routes/api/processes/[id]/refresh.ts:1-5`, `src/modules/process/interface/http/process.controllers.ts:395-495`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:150-233`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:153-220`).
- active provider fetch path lives in agent, not in current server routes. server owns enqueue, leasing, ingestion, normalization, derivation, and read-model responses (`apps/agent/src/agent.ts:630-767`, `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`, `src/modules/tracking/interface/http/agent-sync.controllers.ts:167-263`, `src/modules/tracking/application/usecases/save-and-process.usecase.ts:35-60`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`).
- There is still unused direct provider-fetch code on server side via `trackingUseCases.fetchAndProcess()`. During this audit no active route/controller call site was found; only tracking facade/usecase definitions were found (`src/modules/tracking/application/tracking.usecases.ts:67-90`, `src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43-98`).
- `sync_requests` is operational queue and realtime backbone. It stores `PENDING | LEASED | DONE | FAILED`, leasing metadata, attempts, and last error (`supabase/migrations/20260225_01_agent_sync_mvp.sql:14-40`).
- Sync overlap prevention is durable queue-backed dedup, not per-process memory. Repeated manual sync requests may reuse same open `sync_requests` row instead of relying on local in-memory `409` guards (`supabase/migrations/20260225_02_refresh_queue_first.sql:23-117`, `src/shared/api/sync.bootstrap/sync.bootstrap.ports.ts:182-206`).
- UI sync UX uses both realtime and polling. Realtime is Supabase Postgres changes on `public.sync_requests`; polling is fallback and watchdog (`src/shared/supabase/sync-requests.realtime.ts:151-285`, `src/modules/process/ui/ShipmentView.tsx:406-515`, `src/modules/process/ui/utils/sync-realtime-coordinator.ts:21-199`).
- No webhook flow was found. No SSE or native WebSocket flow was found. No server-side cron for provider fetch was found. Automatic sync today is agent interval scheduler plus realtime wake (`apps/agent/src/agent.scheduler.ts:18-89`, `apps/agent/src/agent.ts:787-866`).

## Current High-Level Model

```text
UI
  -> POST /api/refresh or POST /api/processes/*/sync|refresh
  -> server enqueues into sync_requests
  -> agent leases targets from GET /api/agent/targets
  -> agent fetches provider payload
  -> agent POSTs raw payload to /api/tracking/snapshots/ingest
  -> server persists snapshot and runs tracking pipeline
  -> server marks sync_requests DONE/FAILED
  -> UI sees sync_requests change via realtime and/or polling
  -> UI refetches process read models
```

Sources: `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`, `src/modules/tracking/interface/http/agent-sync.controllers.ts:123-263`, `apps/agent/src/agent.ts:630-767`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`, `src/modules/process/ui/ShipmentView.tsx:406-515`.

## Component Matrix

|Component|Responsibility|Inputs|Outputs|Persistence touched|Owner|
| --- | --- | --- | --- | --- | --- |
|`POST /api/refresh`|Validate manual refresh request and enqueue one container sync|UI/manual HTTP body `{ container, carrier }`|`202` + `syncRequestId`|`sync_requests` via `enqueue_sync_request`|tracking/interface HTTP (`src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`)|
|`POST /api/processes/:id/refresh`|Enqueue refresh for one process or one container within process|process id + mode/body|`202` + queued requests/failures|`sync_requests` via process bootstrap enqueue port|process feature `process-sync` (`src/modules/process/interface/http/process.controllers.ts:463-490`, `src/modules/process/features/process-sync/application/usecases/refresh-process.usecase.ts:79-167`, `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95-124`)|
|`POST /api/processes/:id/sync` / `POST /api/processes/sync`|Enqueue and synchronously wait for terminal queue states|process id or all active processes|`200` or timeout/error|`sync_requests` read/write via enqueue + status polling|process feature `process-sync` (`src/modules/process/interface/http/process.controllers.ts:395-459`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:113-220`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:110-233`)|
|`sync_requests` table + RPCs|Queue state, dedupe, leasing, attempts|enqueue, lease|leased rows, queue metadata|`sync_requests`|database/infra (`supabase/migrations/20260225_01_agent_sync_mvp.sql:18-98`, `supabase/migrations/20260225_02_refresh_queue_first.sql:23-117`)|
|`GET /api/agent/targets`|Authenticate agent and lease work|agent token, tenant id, limit|target list + `leased_until`|`sync_requests`, `tracking_agents`|tracking/interface HTTP (`src/modules/tracking/interface/http/agent-sync.controllers.ts:123-165`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:35-51`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:146-167`)|
|agent runtime|Schedule cycles, fetch providers, ingest raw payload|queue targets|provider payloads posted to server|none directly in DB|agent/runtime (`apps/agent/src/agent.scheduler.ts:18-89`, `apps/agent/src/agent.ts:630-866`)|
|`POST /api/tracking/snapshots/ingest`|Validate lease, resolve container, persist snapshot, run tracking pipeline, finalize request|agent token + raw snapshot|`202` + `snapshot_id`|`container_snapshots`, `container_observations`, `tracking_alerts`, `sync_requests`|tracking/interface + tracking/application (`src/modules/tracking/interface/http/agent-sync.controllers.ts:167-263`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-144`)|
|`GET /api/processes/:id`|Compose process detail read model for UI|process id|`ProcessDetailResponse`|reads process/container/tracking + `sync_requests` metadata|process/interface HTTP (`src/modules/process/interface/http/process.controllers.ts:225-315`, `src/modules/process/interface/http/process.http.mappers.ts:388-441`, `src/shared/api-schemas/processes.schemas.ts:164-186`)|
|UI realtime helpers|Subscribe to `sync_requests` by ids or container refs|process detail/dashboard container refs|ephemeral UI sync state, refetch triggers|none|shared/ui infra (`src/shared/api/sync-requests.realtime.client.ts:1-35`, `src/shared/supabase/sync-requests.realtime.ts:151-285`)|

## Confirmed Answers to the Most Important Questions

### Is there still direct server -> provider fetch on-demand?

Active routes no longer do that. legacy direct Maersk route returns `410 Gone`, and active refresh routes only enqueue queue work. only direct server fetch logic found in audit is unused `trackingUseCases.fetchAndProcess()` path (`src/routes/api/refresh-maersk/[container].ts:1-16`, `src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/tracking/application/tracking.usecases.ts:67-90`, `src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43-98`).

### Where does sync job creation happen?

It happens in enqueue RPC `public.enqueue_sync_request`, called from:

- tracking refresh bootstrap for `POST /api/refresh`
- process bootstrap for `POST /api/processes/:id/refresh`
- process bootstrap for synchronous process sync endpoints

Sources: `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:43-69`, `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95-124`, `supabase/migrations/20260225_02_refresh_queue_first.sql:27-117`.

### Does the server still execute ingestion/derivation?

Yes. agent only fetches raw provider payloads. server executes `saveAndProcess()`, which persists snapshot and runs normalize -> diff -> observation persistence -> timeline -> status -> alerts (`apps/agent/src/agent.ts:689-733`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:133-144`, `src/modules/tracking/application/usecases/save-and-process.usecase.ts:35-60`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`).

## Known Gaps at a Glance

- No lease heartbeat/renewal was found. Recovery is by lease expiry only (`supabase/migrations/20260225_01_agent_sync_mvp.sql:59-98`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-118`).
- Agent scrape failures usually do not mark `FAILED` immediately; they log and wait for lease expiration (`apps/agent/src/agent.ts:735-748`).
- process detail UI still refreshes via `/api/refresh` per container instead of newer process refresh endpoint (`src/modules/process/ui/ShipmentView.tsx:333-356`, `src/routes/api/processes/[id]/refresh.ts:1-5`).
- No dead-letter queue, metrics, tracing, or explicit provider rate limiter was found in audited paths (`apps/agent/src/agent.ts:740-855`, `src/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher.ts:17-60`, `src/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher.ts:10-58`, `src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts:277-339`).
- Backfill behavior exists in tracking pipeline contract, but no active backfill entry point was found. This remains **UNKNOWN** operationally (`src/modules/tracking/application/orchestration/pipeline.ts:67-75`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:127-275`).
