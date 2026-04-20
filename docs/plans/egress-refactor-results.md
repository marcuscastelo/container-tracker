# Egress Refactor Results — Process/Tracking Hot Reads

## Status

- Implemented on this branch.
- Baseline audit artifact exists at `docs/plans/egress-audit-process-reads.md`.
- Shared read instrumentation is now wired for:
  - `GET /api/processes/:id`
  - `GET /api/processes/:id/sync-state`
  - `GET /api/processes`
  - `GET /api/processes/sync-status`
  - `GET /api/dashboard/operational-summary`
  - `GET /api/alerts/navbar-summary`
- `[read_audit]` now records canonical `read_strategy` and aggregated `query_operations` for each audited hot request.
- Live DB-egress comparison is still required in dev/staging environment with real data. This branch now emits logs needed for that comparison.

## What Changed

### Hot detail contract

- `GET /api/processes/:id` now returns lean first-paint contract.
- Removed from hot detail payload:
  - `containers[].observations`
  - inline `series_history` transport by default
  - recognized alert archive
  - raw snapshot/debug/replay structures
- Added to lean timeline items:
  - `observation_id`
  - `has_series_history`
- Added `tracking_freshness_token` to shipment detail response.

### Reconciliation split

- Added `GET /api/processes/:id/sync-state`.
- Shipment reconciliation now fetches sync state first and only reloads full detail when `tracking_freshness_token` changes.
- Dashboard realtime reconciliation now uses `GET /api/processes/sync-status` instead of refetching full process list on every terminal sync event.

### Lazy history/detail endpoints

- Added `GET /api/processes/:id/alerts/recognized`
- Added `GET /api/tracking/containers/:containerId/timeline-items/:timelineItemId/history`
- Added `GET /api/tracking/containers/:containerId/observations/:observationId`
- Prediction history, observation inspector, and recognized alert archive now load on demand.

### Backend read-model/query changes

- Added canonical batch tracking projections for process detail, process list aggregation, dashboard operational summary, and navbar active-alert summary.
- Added lazy detail use cases for recognized incidents, series history, and observation inspector flows.
- Replaced hot-path `select('*')` reads with explicit projections for observations and alerts.
- Removed legacy per-container fallback from process detail, dashboard list aggregation, and tracking batch projection itself.
- Dashboard list aggregation and navbar active-alert summary now read summary-shaped batch projections directly instead of loading full history and compressing it in memory.

### Frequency reduction

- Removed viewport-driven shipment-detail prefetch from dashboard navigation.
- Kept intent-based prefetch only.

## Before / After

## Baseline reference

- Problem statement baseline: common process detail responses were reported in `~30–60KB` range.
- Structural audit baseline:
  - process detail loaded full observation history, alert history, and inline series history per container
  - dashboard list aggregated via per-container `getContainerSummary(...)`
  - recognized/archive incidents were included in hot shipment read

## Branch-local verified payload sizes

These numbers come from deterministic controller tests on this branch. They are useful for contract-size verification, but they are not substitutes for live-data measurement.

|Endpoint|Verified local response size|
| --- | ---: |
|`GET /api/processes/:id` lean detail (simple synthetic cases)|`2,552–4,392 bytes`|
|`GET /api/processes/:id/sync-state`|`478 bytes`|
|`GET /api/processes/:id/alerts/recognized`|`1,415 bytes`|
|`GET /api/dashboard/operational-summary`|`747 bytes`|

## Budget check

- Shipment detail first paint:
  - Local branch verification is comfortably below interim `<= 20KB` budget.
  - Live-data verification is still required for representative multi-container / history-heavy processes.
- Sync snapshot:
  - Verified locally at `478 bytes`, well below `<= 3KB` target.
- Recognized alert archive:
  - Moved fully off hot path.

## Largest Wins

1. Shipment first paint no longer ships raw observation history or recognized alert archive by default.
2. Timeline history is now modal/lazy instead of being embedded in every visible primary item.
3. Sync reconciliation is now snapshot-first, with full detail reload gated by `tracking_freshness_token`.
4. Dashboard realtime sync no longer forces full process-list refetch on every terminal event.
5. Hot observation/alert repositories now use explicit column selection, preserving egress-first query-shaping goal.
6. No audited hot endpoint silently falls back to per-container summary fan-out anymore.

## Fallback Elimination

- Removed legacy fallback chain from:
  - process detail hot reads
  - process list operational summary aggregation
  - tracking batch hot-read projection internals
- Migrated hot callers to canonical batch-only entry points:
  - `findContainersHotReadProjection(...)`
  - `findContainersOperationalSummaryProjection(...)`
- Kept `getContainerSummary(...)` only for non-hot callers such export/import and replay-oriented flows.
- Made batch repository methods mandatory for hot reads:
  - `ObservationRepository.findAllByContainerIds(...)`
  - `TrackingAlertRepository.findActiveByContainerIds(...)`
- Extended runtime proof via `[read_audit]` so hot requests now identify canonical strategy used:
  - `tracking.hot_read_projection.process_detail`
  - `tracking.hot_read_projection.process_sync_snapshot`
  - `tracking.hot_read_projection.dashboard_operational_summary`
  - `tracking.operational_summary_projection.navbar_alerts`
  - `sync.status_projection`

## Remaining Hotspots

1. Live DB byte-read / rows-read validation is still pending.
   - instrumentation is shipped, but representative runtime samples still need to be collected from non-mocked environment.
2. Full repo `pnpm check` is still blocked by unrelated workspace issues.
   - Current known unrelated failures include:
     - `dep-graph.html` max-size check
     - `dep-graph.json` formatting
     - `package.json` formatting
     - `scripts/depgraph-columns.mjs` formatting/import order

## Deferred UX Follow-Ups

- After live audit numbers are collected, decide whether any additional first-paint trimming is needed for history-heavy multi-container shipments.
- Evaluate whether dashboard manual sync can also avoid immediate full list refetch in more cases.
- Consider index follow-ups only after audited DB logs identify dominant remaining query shapes.

## Verification Performed

- `pnpm exec tsc -p tsconfig.app.json --noEmit --skipLibCheck`
- `pnpm exec vitest run src/modules/process/interface/http/tests/process.controllers.test.ts src/capabilities/dashboard/interface/http/tests/dashboard.controllers.operational-summary.test.ts src/modules/process/features/operational-projection/application/tests/aggregateOperationalSummary.test.ts src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts src/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource.test.ts src/modules/tracking/interface/http/tests/tracking.controllers.test.ts`
- `pnpm exec vitest run src/modules/process/ui/tests/fetchProcess.cache.test.ts src/modules/process/ui/mappers/tests/processDetail.arrived-status.ui-mapper.test.ts src/modules/process/ui/mappers/tests/containerSummary.ui-mapper.test.ts src/modules/process/ui/screens/shipment/lib/shipmentAlertNavigation.test.ts`
- `pnpm exec vitest run src/modules/tracking/features/replay/application/tests/tracking-time-travel.readmodel.test.ts src/modules/tracking/application/projection/tests/voyageSegments.test.ts src/modules/process/ui/timeline/tests/timelineBlockModel.test.ts src/modules/process/ui/utils/tests/current-tracking-context.test.ts`
- `pnpm exec vitest run src/modules/process/interface/http/tests/process.controllers.test.ts src/modules/process/application/usecases/tests/list-processes-with-operational-summary.usecase.test.ts src/modules/tracking/application/usecases/tests/find-containers-hot-read-projection.usecase.test.ts src/modules/tracking/application/usecases/tests/find-containers-operational-summary-projection.usecase.test.ts src/capabilities/dashboard/application/tests/dashboard.navbar-alerts.readmodel.test.ts src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts src/capabilities/dashboard/interface/http/tests/dashboard.controllers.operational-summary.test.ts src/capabilities/dashboard/interface/http/tests/dashboard.controllers.navbar-summary.test.ts src/capabilities/sync/interface/http/tests/sync-status.controllers.test.ts`

## Follow-Up Required For Completion Of The Audit Loop

1. Deploy or run app against representative dev data.
2. Capture at least 10 requests per audited endpoint from `[read_audit]` logs.
3. Fill in before/after live numbers for:
   - response bytes
   - read strategy
   - query count
   - query operations
   - DB time
   - estimated rows read / returned
   - estimated DB read bytes
4. Re-rank remaining hotspots based on real `bytes x frequency`.
