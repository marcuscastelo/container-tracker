# Egress Audit — Process/Tracking Hot Reads

## Status

- Follow-up complete: legacy per-container summary fallback has been removed from audited hot paths.
- This document now reflects canonical post-refactor read paths plus shared request/DB observability emitted by this branch.
- Runtime samples should be captured from audited logs for at least 10 representative requests per endpoint after this branch is deployed to dev environment with live data.

## Scope

Audited hot endpoints:

- `GET /api/processes/:id`
- `GET /api/processes/:id/sync-state`
- `GET /api/processes`
- `GET /api/processes/sync-status`
- `GET /api/dashboard/operational-summary`
- `GET /api/alerts/navbar-summary`

## Method

### Structural findings

- `GET /api/processes/:id`
  - `process.controllers.ts` loads process + containers, then delegates to `resolveProcessDetailTracking`.
  - `resolveProcessDetailTracking` now calls `trackingUseCases.findContainersHotReadProjection(...)` once for full container set.
  - canonical hot-read projection batches observation and active-alert reads, then derives lean operational state from those projections only.
  - Response stays first-paint sized: no inline raw observations, no recognized alert archive, and no full `series_history` payload by default.
- `GET /api/processes/:id/sync-state`
  - Uses same lean process/container fetch with sync metadata only.
  - Read audit identifies this path separately `tracking.hot_read_projection.process_sync_snapshot`.
- `GET /api/processes`
  - `list-processes-with-operational-summary.usecase.ts` loads all processes + containers.
  - It then calls `trackingUseCases.findContainersHotReadProjection(...)` once for all containers in scope.
  - Process summaries are aggregated from lean batch projection only; there is no per-container fallback branch left in hot path.
- `GET /api/processes/sync-status`
  - Already relatively lean at HTTP layer.
  - This endpoint is preferred reconciliation path for dashboard/process sync visibility.
- `GET /api/dashboard/operational-summary`
  - Depends on aggregated process/tracking operational read models.
  - This hot dashboard read now emits same `read_strategy` and `query_operations` audit fields other audited routes.
- `GET /api/alerts/navbar-summary`
  - Uses `trackingUseCases.findContainersOperationalSummaryProjection(...)` to read active-alert summary state in batch.
  - This endpoint no longer depends on legacy `getContainersSummary(...)` loop for its hot navbar payload.

### Canonical hot-read guardrails

- No per-container `getContainerSummary(...)` fan-out in process detail, process list, dashboard operational summary, or navbar active-alert summary.
- No `if batch missing -> per-container` rescue branch inside canonical tracking hot-read projection.
- Hot observation and alert repositories use explicit column projections instead of `select('*')`.
- Hot paths keep recognized/archive incidents, observation inspection, and timeline history on lazy/on-demand endpoints.
- Runtime proof comes from `[read_audit]` `read_strategy` plus aggregated `query_operations`, making fallback reintroduction visible.

## Section A — Hot Endpoints Ranked By Estimated DB Cost

### 1. `GET /api/processes/:id`

- Estimated DB cost rank: `highest`
- Why:
  - 1 process read
  - 1 container list read
  - 1 sync metadata read
  - 1 batch observation read for requested container set
  - 1 batch active-alert read for requested container set
  - timeline/status/operational derivation once from batch projection
- Trigger sources:
  - initial shipment load
  - shipment refetch after sync / refresh
  - manual reload
  - shipment intent prefetch

### 2. `GET /api/processes`

- Estimated DB cost rank: `high`
- Why:
  - process list response is lean and now uses single batch hot-read projection for all containers in scope
  - cost still scales with result-set size, but no longer with per-container historical fan-out
- Trigger sources:
  - dashboard first load
  - dashboard manual refresh
  - dashboard realtime reconciliation
  - dashboard prefetch

### 3. `GET /api/dashboard/operational-summary`

- Estimated DB cost rank: `medium`
- Why:
  - aggregated dashboard read
  - payload is smaller than shipment detail, but frequency is high on dashboard visits
  - still important for instrumentation because it participates in dashboard refresh flows

### 4. `GET /api/alerts/navbar-summary`

- Estimated DB cost rank: `medium-low`
- Why:
  - summary-shaped navbar payload
  - reads operational state from batch projection instead of per-container summary fan-out
  - participates in same dashboard visitation cadence other hot summary reads

### 5. `GET /api/processes/:id/sync-state`

- Estimated DB cost rank: `low`
- Why:
  - uses same lean process/container fetch with sync metadata only
  - designed specifically to replace heavyweight reconciliation reloads

### 6. `GET /api/processes/sync-status`

- Estimated DB cost rank: `low`
- Why:
  - operational sync-state read already has compact contract
  - should remain preferred reconciliation path for dashboard/process sync visibility

## Section B — Payload Sections Ranked By Response Bytes

### 1. `containers[].observations`

- Removed from hot shipment detail contract.
- Observation inspector remains owner of full observation-row drill-down.

### 2. `containers[].timeline[].series_history`

- Removed from first paint.
- Timeline history now belongs to lazy history endpoint.

### 3. `alert_incidents.recognized`

- Removed from hot detail.
- Recognized/archive incidents now live behind `GET /api/processes/:id/alerts/recognized`.

### 4. `alerts`

- Hot detail keeps only active/visible alert state needed for rendering and highlighting.
- Archive/recognized history no longer inflates default payload.

### 5. Snapshot-enriched observation fields

- Kept out of hot path unless explicitly requested by drill-down flow.
- This avoids extra reads that do not change first-paint understanding.

## Section C — Eliminated Waste Candidates

### Candidate 1 — Shipment detail no longer loads raw observations for every container on first paint

- Raw observations were removed from first-paint response contract.
- Observation inspection remains available through lazy detail endpoint.

### Candidate 2 — Shipment detail no longer ships `series_history` inline by default

- Heavy timeline history moved to lazy history endpoint.
- Hot detail only carries lean timeline primaries plus `has_series_history`.

### Candidate 3 — Shipment detail no longer loads recognized / archive incidents by default

- Recognized/archive incidents moved to `GET /api/processes/:id/alerts/recognized`.
- Hot detail only includes active/visible alert state.

### Candidate 4 — Dashboard process list no longer derives summary by loading full tracking history per container

- process list now uses single batch canonical projection.
- There is no remaining per-container fallback branch in hot summary path.

### Candidate 5 — Navbar active-alert summary no longer loops over legacy per-container summaries

- navbar summary now reads `findContainersOperationalSummaryProjection(...)` in batch.
- Active alerts stay summary-shaped at backend and at HTTP boundary.

### Candidate 6 — Viewport-driven shipment-detail prefetch

- Removed from dashboard scrolling behavior.
- Intent-based prefetch remains only supported prefetch strategy.

## Representative Request Matrix

These are request classes that must be sampled from new logs:

1. Shipment detail first load
2. Shipment detail after manual refresh enqueue
3. Shipment detail after sync completion reconciliation
4. Shipment sync-state snapshot check
5. Dashboard first load
6. Dashboard realtime reconciliation
7. Dashboard manual refresh
8. Dashboard -> shipment intent prefetch
9. Navbar active-alert summary load
10. Prediction history / observation inspector expansion

## Measurement Fields To Capture From Logs

- endpoint name
- request id
- projection/read-model name
- read strategy
- trigger source
- response bytes
- total DB time
- query count
- query operations
- estimated rows returned
- estimated rows read
- touched tables

## Current Canonical Decision

hot path is now intentionally split into one canonical batch strategy per surface:

1. `findContainersHotReadProjection(...)` for process detail, process list aggregation, and process sync snapshot support.
2. `findContainersOperationalSummaryProjection(...)` for navbar active-alert summary.
3. Lazy/on-demand endpoints for recognized archive, observation inspection, and timeline history.
