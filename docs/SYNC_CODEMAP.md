# Sync Codemap

## Purpose

This file lists the main source files involved in sync, grouped by responsibility.

## HTTP entry points

| File | Role |
| --- | --- |
| `src/routes/api/refresh.ts` | thin adapter for `POST /api/refresh` and health (`src/routes/api/refresh.ts:1-15`) |
| `src/routes/api/refresh/status.ts` | thin adapter for queue status polling (`src/routes/api/refresh/status.ts:1-13`) |
| `src/routes/api/refresh-maersk/[container].ts` | deprecated direct server-refresh route; returns `410` (`src/routes/api/refresh-maersk/[container].ts:1-16`) |
| `src/routes/api/processes/[id]/index.ts` | process detail route adapter (`src/routes/api/processes/[id]/index.ts:1-5`) |
| `src/routes/api/processes/[id]/refresh.ts` | async process refresh route adapter (`src/routes/api/processes/[id]/refresh.ts:1-5`) |
| `src/routes/api/processes/[id]/sync.ts` | synchronous single-process sync route adapter (`src/routes/api/processes/[id]/sync.ts:1-5`) |
| `src/routes/api/processes/sync.ts` | synchronous global sync route adapter (`src/routes/api/processes/sync.ts:1-5`) |
| `src/routes/api/processes/sync-status.ts` | process sync observability route adapter (`src/routes/api/processes/sync-status.ts:1-3`) |
| `src/routes/api/agent/targets.ts` | agent leasing route adapter (`src/routes/api/agent/targets.ts:1-13`) |
| `src/routes/api/tracking/snapshots/ingest.ts` | agent ingest route adapter (`src/routes/api/tracking/snapshots/ingest.ts:1-13`) |
| `src/routes/api/agent/enroll.ts` | agent enrollment route adapter (`src/routes/api/agent/enroll.ts:1-13`) |

## Tracking HTTP controllers and schemas

| File | Role |
| --- | --- |
| `src/modules/tracking/interface/http/refresh.controllers.ts` | enqueue/status controller logic for `/api/refresh` (`src/modules/tracking/interface/http/refresh.controllers.ts:58-118`) |
| `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts` | Supabase-backed enqueue/status wiring (`src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts:40-124`) |
| `src/modules/tracking/interface/http/refresh.schemas.ts` | HTTP contracts for enqueue/status (`src/modules/tracking/interface/http/refresh.schemas.ts:9-66`) |
| `src/modules/tracking/interface/http/agent-sync.controllers.ts` | agent targets + ingest controller logic (`src/modules/tracking/interface/http/agent-sync.controllers.ts:123-273`) |
| `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts` | lease/find/mark/auth/saveAndProcess wiring (`src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:35-167`) |
| `src/modules/tracking/interface/http/agent-sync.schemas.ts` | agent targets/ingest request and row schemas (`src/modules/tracking/interface/http/agent-sync.schemas.ts:3-62`) |
| `src/modules/tracking/interface/http/agent-enroll.controllers.ts` | enrollment/auth/rate-limit/audit controller (`src/modules/tracking/interface/http/agent-enroll.controllers.ts:156-321`) |
| `src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts` | DB-backed enrollment wiring (`src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:117-263`) |

## Process-side sync orchestration

| File | Role |
| --- | --- |
| `src/modules/process/interface/http/process.controllers.ts` | process detail composition, sync endpoints, refresh endpoint (`src/modules/process/interface/http/process.controllers.ts:125-507`) |
| `src/modules/process/interface/http/process.controllers.bootstrap.ts` | injects process + tracking use cases into process HTTP layer (`src/modules/process/interface/http/process.controllers.bootstrap.ts:7-16`) |
| `src/modules/process/interface/http/process.http.mappers.ts` | maps process/tracking aggregates into response DTOs (`src/modules/process/interface/http/process.http.mappers.ts:155-205`, `src/modules/process/interface/http/process.http.mappers.ts:302-441`) |
| `src/modules/process/application/process.usecases.ts` | process application composition root, including sync use cases (`src/modules/process/application/process.usecases.ts:19-113`) |
| `src/modules/process/features/process-sync/application/usecases/refresh-process.usecase.ts` | async enqueue-only process refresh (`src/modules/process/features/process-sync/application/usecases/refresh-process.usecase.ts:79-167`) |
| `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts` | single-process sync + queue polling (`src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:113-220`) |
| `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts` | global sync + queue polling (`src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:110-233`) |
| `src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts` | dashboard list aggregation with tracking summaries + sync metadata (`src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:320-389`) |
| `src/modules/process/infrastructure/bootstrap/process.bootstrap.ts` | process-side enqueue/status/sync metadata ports (`src/modules/process/infrastructure/bootstrap/process.bootstrap.ts:95-254`) |

## Tracking pipeline and repositories

| File | Role |
| --- | --- |
| `src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts` | tracking use case composition root (`src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts:36-52`) |
| `src/modules/tracking/application/tracking.usecases.ts` | tracking facade, including `saveAndProcess()` and unused `fetchAndProcess()` (`src/modules/tracking/application/tracking.usecases.ts:62-154`) |
| `src/modules/tracking/application/usecases/save-and-process.usecase.ts` | persist raw snapshot then run pipeline (`src/modules/tracking/application/usecases/save-and-process.usecase.ts:35-60`) |
| `src/modules/tracking/application/usecases/fetch-and-process.usecase.ts` | direct server fetch path currently not used by active routes (`src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43-98`) |
| `src/modules/tracking/application/orchestration/pipeline.ts` | normalize -> diff -> persist observations -> derive timeline/status/alerts (`src/modules/tracking/application/orchestration/pipeline.ts:70-130`) |
| `src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts` | timeline derivation, runtime-only projection (`src/modules/tracking/features/timeline/domain/derive/deriveTimeline.ts:225-290`) |
| `src/modules/tracking/features/status/domain/derive/deriveStatus.ts` | derived status logic (`src/modules/tracking/features/status/domain/derive/deriveStatus.ts:21-98`) |
| `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts` | fact vs monitoring alerts, backfill semantics (`src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:133-275`) |
| `src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts` | `container_snapshots` repository (`src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:13-25`) |
| `src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts` | `container_observations` repository (`src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:14-43`) |
| `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` | `tracking_alerts` repository (`src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:18-55`) |
| `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts` | `sync_requests` read-model metadata (`src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts:23-57`) |

## Realtime and UI sync consumers

| File | Role |
| --- | --- |
| `src/shared/supabase/sync-requests.realtime.ts` | reusable realtime subscriptions by ids, tenant, and container refs (`src/shared/supabase/sync-requests.realtime.ts:151-285`) |
| `src/shared/api/sync-requests.realtime.client.ts` | frontend wrapper around the shared realtime helper (`src/shared/api/sync-requests.realtime.client.ts:1-35`) |
| `src/shared/supabase/supabase.ts` | frontend Supabase client used by realtime subscriptions (`src/shared/supabase/supabase.ts:8-47`) |
| `src/modules/process/ui/ShipmentView.tsx` | process detail refresh UX, enqueue + wait + tracking-only refetch (`src/modules/process/ui/ShipmentView.tsx:333-515`) |
| `src/modules/process/ui/utils/refresh-sync-polling.ts` | exponential-backoff status polling helper (`src/modules/process/ui/utils/refresh-sync-polling.ts:62-115`) |
| `src/modules/process/ui/utils/sync-realtime-coordinator.ts` | detail-page realtime + fallback polling coordinator (`src/modules/process/ui/utils/sync-realtime-coordinator.ts:21-199`) |
| `src/modules/process/ui/hooks/useProcessSyncRealtime.ts` | dashboard realtime sync-state projection (`src/modules/process/ui/hooks/useProcessSyncRealtime.ts:115-197`) |
| `src/modules/process/ui/api/processSync.api.ts` | dashboard/process sync API calls (`src/modules/process/ui/api/processSync.api.ts:7-32`) |
| `src/modules/process/ui/utils/dashboard-refresh.ts` | dashboard sync + refetch orchestration (`src/modules/process/ui/utils/dashboard-refresh.ts:16-35`) |
| `src/modules/process/ui/fetchProcess.ts` | detail fetch with 15s in-memory cache (`src/modules/process/ui/fetchProcess.ts:6-116`) |
| `src/modules/process/ui/validation/processApi.validation.ts` | dashboard reads with 15s in-memory cache (`src/modules/process/ui/validation/processApi.validation.ts:21-195`) |

## Agent runtime

| File | Role |
| --- | --- |
| `tools/agent/agent.ts` | main runtime: config, enroll, lease, fetch, ingest, realtime wake (`tools/agent/agent.ts:535-866`) |
| `tools/agent/agent.scheduler.ts` | startup/interval/realtime scheduler (`tools/agent/agent.scheduler.ts:18-89`) |
| `tools/agent/backoff.ts` | enrollment/bootstrap exponential backoff (`tools/agent/backoff.ts:1-31`) |

## Database and contracts

| File | Role |
| --- | --- |
| `supabase/migrations/2026022501_agent_sync_mvp.sql` | `sync_requests` enum/table and lease RPC (`supabase/migrations/2026022501_agent_sync_mvp.sql:14-98`) |
| `supabase/migrations/2026022502_refresh_queue_first.sql` | open-request dedupe and enqueue RPC (`supabase/migrations/2026022502_refresh_queue_first.sql:23-117`) |
| `supabase/migrations/2026022601_agent_runtime_enrolment.sql` | `agent_install_tokens`, `tracking_agents`, enrollment audit (`supabase/migrations/2026022601_agent_runtime_enrolment.sql:8-98`) |
| `supabase/migrations/2026030602_process_sync_observability_and_alert_ack_metadata.sql` | sync observability index on `sync_requests` (`supabase/migrations/2026030602_process_sync_observability_and_alert_ack_metadata.sql:28-31`) |
| `src/shared/api-schemas/processes.schemas.ts` | process detail/list/sync HTTP DTO contracts (`src/shared/api-schemas/processes.schemas.ts:4-246`) |

## Historical but still useful context

| File | Role |
| --- | --- |
| `docs/mvp-agent-sync.md` | historical MVP description; superseded by this docset for current source of truth |
| `docs/AGENT_ARCHITECTURE.md` | older overview doc; now complemented by `SYNC_*` docs |
| `docs/UX-Investigation-Refresh-Alerts.md` | prior UX investigation with refresh behavior notes |
