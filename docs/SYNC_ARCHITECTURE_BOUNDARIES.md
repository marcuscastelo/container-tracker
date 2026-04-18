# Sync Architecture Boundaries

## Canonical Rules to Preserve

- BCs own semantics and invariants; capabilities orchestrate across BCs (`docs/BOUNDARIES.md:7-45`).
- Type flow must remain `Row -> Entity/Aggregate -> Result -> Response DTO -> ViewModel` (`docs/TYPE_ARCHITECTURE.md:24-64`).
- UI must not derive domain truth for tracking (`docs/BOUNDARIES.md:67-80`, `docs/ARCHITECTURE.md:69-95`).
- Tracking owns snapshot ingestion, normalized observations, deterministic derivation, and alert policy (`docs/TRACKING_INVARIANTS.md:7-73`, `docs/TRACKING_EVENT_SERIES.md:71-126`, `docs/ALERT_POLICY.md:24-84`).

## Current Placement by Layer

|Area|Current location|Notes|
| --- | --- | --- |
|Route adapters|`src/routes/api/*`|Thin adapters only. Current sync routes map directly to controller factories (`src/routes/api/refresh.ts:8-15`, `src/routes/api/agent/targets.ts:7-13`, `src/routes/api/tracking/snapshots/ingest.ts:7-13`, `src/routes/api/processes/[id]/refresh.ts:1-5`)|
|HTTP controllers|`src/modules/*/interface/http/*`|Validate requests, map errors, call use cases (`src/modules/tracking/interface/http/refresh.controllers.ts:58-118`, `src/modules/tracking/interface/http/agent-sync.controllers.ts:123-273`, `src/modules/process/interface/http/process.controllers.ts:125-507`)|
|Process sync application logic|`src/modules/process/features/process-sync/application/usecases/*`|Queue orchestration for refresh/sync, still inside process BC (`src/modules/process/application/process.usecases.ts:19-44`, `src/modules/process/features/process-sync/application/usecases/refresh-process.usecase.ts:79-167`, `src/modules/process/features/process-sync/application/usecases/sync-process-containers.usecase.ts:153-220`, `src/modules/process/features/process-sync/application/usecases/sync-all-processes.usecase.ts:150-233`)|
|Tracking pipeline|`src/modules/tracking/application/*` + `src/modules/tracking/features/*`|Canonical ingest/normalize/diff/timeline/status/alerts (`src/modules/tracking/application/usecases/save-and-process.usecase.ts:35-60`, `src/modules/tracking/application/orchestration/pipeline.ts:70-130`)|
|Persistence|`src/modules/*/infrastructure/persistence/*`|DB rows and mappers stay here (`src/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository.ts:13-25`, `src/modules/tracking/infrastructure/persistence/supabaseObservationRepository.ts:14-43`, `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts:18-55`)|
|Shared infra helpers|`src/shared/*`|Supabase client, realtime helper, env, response helpers (`src/shared/api/sync-requests.realtime.client.ts:1-35`, `src/shared/supabase/sync-requests.realtime.ts:151-285`, `src/shared/config/server-env.ts:21-79`)|
|Agent runtime|`apps/agent/src/*`|Runtime/scheduler/bootstrap only; it reuses shared infra fetchers and realtime helpers (`apps/agent/src/agent.ts:11-22`, `apps/agent/src/agent.scheduler.ts:18-89`)|

## Current Boundary Assessment

### What is aligned

- No cross-BC domain import was identified in audited sync paths.
- UI reads Response DTOs and maps to VMs; it does not derive timeline/status/alerts itself (`src/modules/process/ui/mappers/processDetail.ui-mapper.ts:172-255`, `docs/TYPE_ARCHITECTURE.md:140-158`).
- Tracking semantic derivation remains in tracking code on server (`src/modules/tracking/application/orchestration/pipeline.ts:70-130`).
- Agent does not own parallel normalization/derivation stack; it only fetches and posts raw payload (`apps/agent/src/agent.ts:656-733`).

### Finding 1: Cross-BC orchestration currently lives inside the process BC and its HTTP layer

**What**

- `GET /api/processes/:id` composes process BC data with tracking BC data directly in `process.controllers.ts` (`src/modules/process/interface/http/process.controllers.ts:236-315`).
- `listProcessesWithOperationalSummary()` in process application aggregates process/container data with tracking summaries and sync metadata (`src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:320-389`).

**Impact**

- process module currently acts both BC owner and cross-BC composition point for sync-heavy read models.

**Risk**

- Future sync features can keep accreting cross-BC orchestration in process-specific code instead of dedicated capability, making boundaries harder to reason about.

**Mitigation**

- Keep canonical tracking derivation in tracking BC.
- Keep process HTTP/UI limited to DTO/VM mapping.

**Correction plan**

1. Introduce dedicated capability for sync/process-detail composition.
2. Move cross-BC orchestration from `process.controllers.ts` and `listProcessesWithOperationalSummary.usecase.ts` into that capability.
3. Keep process BC exposing only process-owned use cases/read models and tracking BC exposing tracking-owned summaries.

### Finding 2: Process detail refresh UI still uses the generic container enqueue endpoint

**What**

- `ShipmentView` refresh posts to `/api/refresh` once per container, even though process-scoped async refresh endpoint now exists at `POST /api/processes/:id/refresh` (`src/modules/process/ui/ShipmentView.tsx:333-356`, `src/routes/api/processes/[id]/refresh.ts:1-5`).

**Impact**

- Two manual-refresh API contracts coexist for same page.

**Risk**

- Future refresh features such mode selection, batch policies, or process-level observability can diverge between UI paths.

**Mitigation**

- Make one endpoint canonical manual refresh contract for process detail.

**Correction plan**

1. Migrate `ShipmentView` to `POST /api/processes/:id/refresh`.
2. Keep `/api/refresh` only for generic single-container tooling or deprecate it.

### Finding 3: Unused direct server fetch path remains in tracking application facade

**What**

- tracking facade still exposes `fetchAndProcess()` which performs direct provider fetch on server (`src/modules/tracking/application/tracking.usecases.ts:67-90`, `src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43-98`).
- During this audit, no active sync route/controller call site was found for it.

**Impact**

- codebase communicates two competing architectures: queue-first agent fetch vs direct server fetch.

**Risk**

- New work may accidentally revive direct fetch flows in HTTP runtime and blur intended runtime split.

**Mitigation**

- Keep queue-first/agent-first runtime explicit in docs.

**Correction plan**

1. Either remove `fetchAndProcess()` from public facade or move it behind explicit maintenance-only interface.
2. Add tests/docs that assert current HTTP refresh routes are enqueue-only.

## Responsibility Split Recommended Going Forward

|Concern|Should live in|Reason|
| --- | --- | --- |
|enqueue rules, dedupe, leasing|`tracking` infra + tracking HTTP interface|operational queue is tracking-adjacent infra|
|provider fetch execution|`apps/agent/src/*` runtime|isolate scraping and browser/HTTP runtime concerns|
|snapshot normalization, diff, timeline, status, alerts|`tracking` BC|canonical domain truth|
|cross-BC process detail/dashboard composition|capability layer|follows `docs/BOUNDARIES.md` orchestration rule|
|Response DTO mapping|`modules/*/interface/http/*.http.mappers.ts`|preserves type boundaries|
|ViewModel + formatting|`modules/*/ui/*.ui-mapper.ts`|preserves UI boundary|

## Boundaries Not Violated in the Audited Path

- Domain code does not import HTTP or UI in sync path.
- agent uses shared infra/fetch helpers, not tracking domain internals.
- `snake_case` remains confined to persistence and HTTP DTO boundaries for audited sync contracts (`src/modules/tracking/infrastructure/persistence/*`, `src/shared/api-schemas/processes.schemas.ts:164-246`).
