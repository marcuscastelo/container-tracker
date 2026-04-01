# Egress Refactor Results — Process/Tracking Hot Reads

## Status

- Implemented on this branch.
- Baseline audit artifact exists at `docs/plans/egress-audit-process-reads.md`.
- Shared read instrumentation is now wired for:
  - `GET /api/processes/:id`
  - `GET /api/processes`
  - `GET /api/processes/:id/sync-state`
  - `GET /api/processes/sync-status`
  - `GET /api/dashboard/operational-summary`
- Live DB-egress comparison is still required in a dev/staging environment with real data. This branch now emits the logs needed for that comparison.

## What Changed

### Hot detail contract

- `GET /api/processes/:id` now returns a lean first-paint contract.
- Removed from the hot detail payload:
  - `containers[].observations`
  - inline `series_history` transport by default
  - recognized alert archive
  - raw snapshot/debug/replay structures
- Added to lean timeline items:
  - `observation_id`
  - `has_series_history`
- Added `tracking_freshness_token` to the shipment detail response.

### Reconciliation split

- Added `GET /api/processes/:id/sync-state`.
- Shipment reconciliation now fetches sync state first and only reloads full detail when `tracking_freshness_token` changes.
- Dashboard realtime reconciliation now uses `GET /api/processes/sync-status` instead of refetching the full process list on every terminal sync event.

### Lazy history/detail endpoints

- Added `GET /api/processes/:id/alerts/recognized`
- Added `GET /api/tracking/containers/:containerId/timeline-items/:timelineItemId/history`
- Added `GET /api/tracking/containers/:containerId/observations/:observationId`
- Prediction history, observation inspector, and recognized alert archive now load on demand.

### Backend read-model/query changes

- Added batch lean tracking projections for process detail and dashboard aggregation.
- Added lazy detail use cases for recognized incidents, series history, and observation inspector flows.
- Replaced hot-path `select('*')` reads with explicit projections for observations and alerts.
- Dashboard list aggregation no longer depends on per-container full-history shaping for its hot summary path.
- Legacy per-container fallback still exists as a safety net, but it now uses active-alert semantics only and reuses the incident read model instead of returning empty archive state.

### Frequency reduction

- Removed viewport-driven shipment-detail prefetch from dashboard navigation.
- Kept intent-based prefetch only.

## Before / After

## Baseline reference

- Problem statement baseline: common process detail responses were reported in the `~30–60KB` range.
- Structural audit baseline:
  - process detail loaded full observation history, alert history, and inline series history per container
  - dashboard list aggregated via per-container `getContainerSummary(...)`
  - recognized/archive incidents were included in the hot shipment read

## Branch-local verified payload sizes

These numbers come from deterministic controller tests on this branch. They are useful for contract-size verification, but they are not substitutes for live-data measurement.

| Endpoint | Verified local response size |
| --- | ---: |
| `GET /api/processes/:id` lean detail (simple synthetic cases) | `2,552–4,392 bytes` |
| `GET /api/processes/:id/sync-state` | `478 bytes` |
| `GET /api/processes/:id/alerts/recognized` | `1,415 bytes` |
| `GET /api/dashboard/operational-summary` | `747 bytes` |

## Budget check

- Shipment detail first paint:
  - Local branch verification is comfortably below the interim `<= 20KB` budget.
  - Live-data verification is still required for representative multi-container / history-heavy processes.
- Sync snapshot:
  - Verified locally at `478 bytes`, well below the `<= 3KB` target.
- Recognized alert archive:
  - Moved fully off the hot path.

## Largest Wins

1. Shipment first paint no longer ships raw observation history or recognized alert archive by default.
2. Timeline history is now modal/lazy instead of being embedded in every visible primary item.
3. Sync reconciliation is now snapshot-first, with full detail reload gated by `tracking_freshness_token`.
4. Dashboard realtime sync no longer forces a full process-list refetch on every terminal event.
5. Hot observation/alert repositories now use explicit column selection, preserving the egress-first query-shaping goal.

## Remaining Hotspots

1. Live DB byte-read / rows-read validation is still pending.
   - The instrumentation is shipped, but representative runtime samples still need to be collected from a non-mocked environment.
2. The legacy per-container summary fallback still exists.
   - It is safer than before, but the lean batch projection should remain the preferred path everywhere.
3. Full repo `pnpm check` is still blocked by unrelated workspace issues.
   - Current known unrelated failures include:
     - `dep-graph.html` max-size check
     - `dep-graph.json` formatting
     - `package.json` formatting
     - `scripts/depgraph-columns.mjs` formatting/import order

## Deferred UX Follow-Ups

- After live audit numbers are collected, decide whether any additional first-paint trimming is needed for history-heavy multi-container shipments.
- Evaluate whether dashboard manual sync can also avoid an immediate full list refetch in more cases.
- Consider index follow-ups only after the audited DB logs identify the dominant remaining query shapes.

## Verification Performed

- `pnpm exec tsc -p tsconfig.app.json --noEmit --skipLibCheck`
- `pnpm exec vitest run src/modules/process/interface/http/tests/process.controllers.test.ts src/capabilities/dashboard/interface/http/tests/dashboard.controllers.operational-summary.test.ts src/modules/process/features/operational-projection/application/tests/aggregateOperationalSummary.test.ts src/modules/process/ui/mappers/tests/processDetail.ui-mapper.test.ts src/modules/process/ui/screens/shipment/hooks/useShipmentScreenResource.test.ts src/modules/tracking/interface/http/tests/tracking.controllers.test.ts`
- `pnpm exec vitest run src/modules/process/ui/tests/fetchProcess.cache.test.ts src/modules/process/ui/mappers/tests/processDetail.arrived-status.ui-mapper.test.ts src/modules/process/ui/mappers/tests/containerSummary.ui-mapper.test.ts src/modules/process/ui/screens/shipment/lib/shipmentAlertNavigation.test.ts`
- `pnpm exec vitest run src/modules/tracking/features/replay/application/tests/tracking-time-travel.readmodel.test.ts src/modules/tracking/application/projection/tests/voyageSegments.test.ts src/modules/process/ui/timeline/tests/timelineBlockModel.test.ts src/modules/process/ui/utils/tests/current-tracking-context.test.ts`

## Follow-Up Required For Completion Of The Audit Loop

1. Deploy or run the app against representative dev data.
2. Capture at least 10 requests per audited endpoint from `[read_audit]` logs.
3. Fill in before/after live numbers for:
   - response bytes
   - query count
   - DB time
   - estimated rows read / returned
   - estimated DB read bytes
4. Re-rank remaining hotspots based on real `bytes x frequency`.
