# Egress Audit — Process/Tracking Hot Reads

## Status

- Created before contract refactor work, per initiative rule.
- Baseline source for this first pass is a structural audit of the current code path plus the shared request/DB observability added in the same branch.
- Runtime samples should be captured from the new audited logs for at least 10 representative requests per endpoint after this branch is deployed to a dev environment with live data.

## Scope

Audited hot endpoints:

- `GET /api/processes/:id`
- `GET /api/processes`
- `GET /api/processes/sync-status`
- `GET /api/dashboard/operational-summary`

## Method

### Structural findings

- `GET /api/processes/:id`
  - `process.controllers.ts` loads the process + containers, then delegates to `resolveProcessDetailTracking`.
  - `resolveProcessDetailTracking` calls `trackingUseCases.getContainerSummary(...)` once per container.
  - Each per-container summary loads full observation history, alert history, and may trigger snapshot enrichment.
  - Response includes observations, timeline series history, alert archive, and sync metadata in one payload.
- `GET /api/processes`
  - `list-processes-with-operational-summary.usecase.ts` loads all processes + containers.
  - It then calls `trackingUseCases.getContainerSummary(...)` once per container to build dashboard summaries.
  - Current response is summary-sized, but backend read cost scales with full observation history per container.
- `GET /api/processes/sync-status`
  - Already relatively lean at the HTTP layer.
  - This endpoint is a candidate for heavier use during reconciliation because its response is small and operational-only.
- `GET /api/dashboard/operational-summary`
  - Depends on aggregated process/tracking operational read models.
  - This is less payload-heavy than shipment detail, but it is a hot dashboard read and should still emit the same audit metrics.

### Current hot-read anti-patterns

- Per-container `getContainerSummary(...)` fan-out from process detail.
- Per-container `getContainerSummary(...)` fan-out from dashboard process list.
- `select('*')` in hot observation and alert reads.
- Hot path loads acknowledged / recognized alert history even when first paint only uses active incidents.
- Hot path ships raw observations and full `series_history` even though history/inspection are modal flows.
- Snapshot-based carrier-label enrichment can trigger extra reads on detail loads.

## Section A — Hot Endpoints Ranked By Estimated DB Cost

### 1. `GET /api/processes/:id`

- Estimated DB cost rank: `highest`
- Why:
  - 1 process read
  - 1 container list read
  - 1 sync metadata read
  - `N` full observation-history reads
  - `N` alert-history reads
  - optional snapshot enrichment reads
  - timeline/status/operational derivation repeated per container after full-history load
- Trigger sources:
  - initial shipment load
  - shipment refetch after sync / refresh
  - manual reload
  - shipment prefetch

### 2. `GET /api/processes`

- Estimated DB cost rank: `very high`
- Why:
  - process list response is lean, but backend currently loads full tracking history for each container in the dashboard result set
  - cost scales with visible and non-visible rows because aggregation happens before pagination/render concerns
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

### 4. `GET /api/processes/sync-status`

- Estimated DB cost rank: `low`
- Why:
  - operational sync-state read already has a compact contract
  - should become the preferred reconciliation path for dashboard/process sync visibility

## Section B — Payload Sections Ranked By Response Bytes

### 1. `containers[].observations`

- Always loaded in shipment detail today.
- High duplication of location/vessel/provider metadata across full history.
- Not directly visible in first paint; only observation inspector needs the full row.

### 2. `containers[].timeline[].series_history`

- Dense historical payload embedded inside every primary timeline item.
- First paint only needs main timeline primaries.
- Prediction history is a modal flow and should be lazy.

### 3. `alert_incidents.recognized`

- Historical / archive data.
- Currently shipped with hot detail even though it is rendered in a collapsed section.

### 4. `alerts`

- Current shipment response ships process-level alert list and then also ships incident-oriented grouping.
- The default panel is action-oriented; hot path should keep only active alert rows needed for visible rendering and highlighting.

### 5. Snapshot-enriched observation fields

- Carrier label enrichment can force additional reads that do not change first-paint understanding for most shipment views.
- This belongs in observation-inspector diagnostics, not in the hot path.

## Section C — Clear Waste Candidates

### Candidate 1 — Shipment detail loads raw observations for every container

- Loaded always but not visible initially.
- Loaded from DB, then condensed into a smaller visible timeline + status summary.
- Repeated across post-mutation refetches and prefetches.

### Candidate 2 — Shipment detail ships `series_history` inline

- Heavy history content embedded in every timeline primary.
- Only needed after explicit user intent.

### Candidate 3 — Shipment detail loads recognized / archive incidents by default

- Collapsed by default in UI.
- Historical and secondary, not first-paint essential.

### Candidate 4 — Dashboard process list derives summary by loading full tracking history per container

- DB-heavy even though HTTP payload is already summary-shaped.
- Clear example of “load history then compress in memory”.

### Candidate 5 — Snapshot enrichment on the hot path

- Extra DB reads for audit/UI context that is only needed in drill-down.

### Candidate 6 — Viewport-driven shipment-detail prefetch

- Multiplies calls to the heaviest endpoint during dashboard scrolling.
- Waste compounds with the current universal process detail contract.

## Representative Baseline Request Matrix

These are the request classes that must be sampled from the new logs:

1. Shipment detail first load
2. Shipment detail after manual refresh enqueue
3. Shipment detail after sync completion reconciliation
4. Dashboard first load
5. Dashboard realtime reconciliation
6. Dashboard manual refresh
7. Dashboard -> shipment intent prefetch
8. Shipment tab/container switch
9. Active alerts panel open on shipment view
10. Prediction history / observation inspector expansion

## Measurement Fields To Capture From Logs

- endpoint name
- request id
- projection/read-model name
- trigger source
- response bytes
- total DB time
- query count
- estimated rows returned
- estimated rows read
- touched tables

## Initial Decision

Top three waste sources for this implementation pass:

1. Shipment detail over-reads observation and alert history.
2. Dashboard list uses per-container full-history tracking reads.
3. Shipment/dashboard reconciliation paths overuse heavyweight reads or prefetches.
