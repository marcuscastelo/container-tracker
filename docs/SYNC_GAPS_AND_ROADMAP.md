# Sync Gaps And Roadmap

## Purpose

This document records the main sync findings from the audit, with impact, risk, mitigation, and a correction path that preserves boundaries.

## Findings

### Finding 1: No lease heartbeat / renewal

**What**

The queue model has `leased_until`, but no heartbeat/renew endpoint/function was found. Work is reclaimed only after lease expiry (`supabase/migrations/20260225_01_agent_sync_mvp.sql:59-98`, `src/modules/tracking/interface/http/agent-sync.controllers.bootstrap.ts:53-118`).

**Impact**

Long-running scrapes can look stuck until TTL expiry.

**Risk**

Duplicate processing, delayed recovery, and operator uncertainty around whether a job is still active or just abandoned.

**Mitigation**

Add explicit lease renewal/heartbeat from the agent runtime without moving semantic tracking logic out of the server.

**Correction plan**

1. Add `renew_sync_request_lease(sync_request_id, tenant_id, agent_id)` RPC.
2. Renew lease during long-running fetches, especially Maersk Puppeteer.
3. Add `last_heartbeat_at` or equivalent operational timestamp for observability.

### Finding 2: Most agent target failures do not mark `FAILED` immediately

**What**

`processTarget()` logs errors and waits for lease expiration; it does not immediately terminalize the job in the normal scrape failure path (`tools/agent/agent.ts:735-748`).

**Impact**

The queue can remain `LEASED` even when the agent already knows the attempt failed.

**Risk**

UI can show prolonged syncing states and operational diagnosis becomes slower.

**Mitigation**

Add an explicit "mark failed attempt" path distinct from lease-conflict cases.

**Correction plan**

1. Add `POST /api/agent/targets/fail` or equivalent RPC-backed failure endpoint.
2. Persist provider/network/browser failures into `last_error` immediately.
3. Keep retry policy controlled by queue state, not by hidden agent logs.

### Finding 3: Two sync paradigms coexist

**What**

The system supports queue-first async refresh and synchronous HTTP endpoints that wait for queue completion (`src/modules/tracking/interface/http/refresh.controllers.ts:58-69`, `src/modules/process/interface/http/process.controllers.ts:395-495`).

**Impact**

Mental model is harder to explain and future features can target different contracts by accident.

**Risk**

Retry, backoff, timeout, and observability semantics drift across endpoints.

**Mitigation**

Standardize on one external contract for user-triggered sync.

**Correction plan**

1. Prefer async enqueue endpoints externally.
2. Move sync completion observation to dedicated read models/realtime, not blocking HTTP.
3. Deprecate or narrow `/api/processes/sync` and `/api/processes/:id/sync`.

### Finding 4: Process detail refresh still uses the older generic refresh route

**What**

`ShipmentView` still calls `/api/refresh` per container instead of the newer process refresh endpoint (`src/modules/process/ui/ShipmentView.tsx:333-356`, `src/routes/api/processes/[id]/refresh.ts:1-5`).

**Impact**

Detail refresh bypasses the more explicit process-scoped API.

**Risk**

Feature drift between detail page and future process-level sync controls.

**Mitigation**

Move the detail page to the process refresh endpoint and use the existing `mode` contract.

**Correction plan**

1. Replace per-container `/api/refresh` calls with `POST /api/processes/:id/refresh`.
2. Keep single-container mode through `mode='container'`.
3. Reuse the same status/realtime follow-up model.

### Finding 5: Cross-BC read-model orchestration is not isolated in a capability

**What**

Process detail composition happens in `process.controllers.ts`, and process list aggregation happens in `listProcessesWithOperationalSummary.usecase.ts` (`src/modules/process/interface/http/process.controllers.ts:225-315`, `src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:320-389`).

**Impact**

The process BC currently carries orchestration responsibilities that the architecture docs reserve for capability-style composition.

**Risk**

More sync/read-model logic may accumulate in process-specific files and blur responsibility ownership.

**Mitigation**

Introduce a capability layer for sync/process-detail aggregation while keeping tracking derivation in the tracking BC.

**Correction plan**

1. Create a dedicated sync/process-read capability.
2. Move cross-BC aggregation there.
3. Leave process/tracking BCs exposing only their own application contracts.

### Finding 6: Unused direct server fetch path still exists

**What**

`trackingUseCases.fetchAndProcess()` still exists, but no active route/controller call site was found during the audit (`src/modules/tracking/application/tracking.usecases.ts:67-90`, `src/modules/tracking/application/usecases/fetch-and-process.usecase.ts:43-98`).

**Impact**

Docs and future contributors can misread the current runtime split.

**Risk**

Accidental reintroduction of direct provider fetches in the HTTP server.

**Mitigation**

Make queue-first agent fetch the explicit documented default and narrow the unused path.

**Correction plan**

1. Remove the public facade export if no caller needs it.
2. Or move it behind a maintenance-only/admin-only path with explicit naming.

### Finding 7: Observability is mostly logs plus enrollment audit

**What**

Observed mechanisms:

- console logs across server and agent
- `agent_enrollment_audit_events`
- `sync_requests` timestamps/statuses for operational inspection

But no metrics, tracing, or job lifecycle analytics pipeline was found (`src/modules/tracking/interface/http/agent-enroll.controllers.ts:156-173`, `src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts:238-257`, `tools/agent/agent.ts:740-855`).

**Impact**

Harder to answer operational questions such as failure rate by provider, queue latency, or stuck lease rate.

**Risk**

Reliability work will be reactive instead of measurable.

**Mitigation**

Add observability around queue age, lease age, attempts, failure cause, and provider latency.

**Correction plan**

1. Add structured job lifecycle logs.
2. Add process sync observability dashboards using `sync_requests`.
3. Add metrics/tracing incrementally once the job model is stabilized.

### Finding 8: Backfill is latent but not operationalized

**What**

`isBackfill` exists in the pipeline and alert derivation, but no runnable backfill path was found in the audited sync runtime (`src/modules/tracking/application/orchestration/pipeline.ts:67-75`, `src/modules/tracking/features/alerts/domain/derive/deriveAlerts.ts:127-275`).

**Impact**

The domain is partially ready for backfill semantics, but operations are not.

**Risk**

Future backfill work may bypass existing alert/timeline invariants if it is implemented ad hoc.

**Mitigation**

Design backfill as a first-class sync mode before any bulk onboarding/backfill feature ships.

**Correction plan**

1. Add an explicit backfill job type/mode.
2. Define live-vs-backfill behavior at the queue contract.
3. Reuse existing `isBackfill` semantics in the server pipeline.

## Quick Wins

1. Migrate `ShipmentView` to `POST /api/processes/:id/refresh` and reduce endpoint fragmentation (`src/modules/process/ui/ShipmentView.tsx:333-356`, `src/routes/api/processes/[id]/refresh.ts:1-5`).
2. Add immediate failure marking for agent scrape/ingest failures instead of waiting for lease expiry (`tools/agent/agent.ts:735-748`).
3. Add lease heartbeat/renewal for long-running jobs (`supabase/migrations/20260225_01_agent_sync_mvp.sql:59-98`).
4. Add a focused sync ops panel on top of `GET /api/processes/sync-status` and `sync_requests` timestamps (`src/modules/process/interface/http/process.controllers.ts:163-186`, `supabase/migrations/20260306_02_process_sync_observability_and_alert_ack_metadata.sql:28-31`).
5. Remove or quarantine unused direct server fetch API surface (`src/modules/tracking/application/tracking.usecases.ts:67-90`).

## Incremental Roadmap

### Phase 1: Clarify the contract

- Choose async queue-first refresh as the canonical user-facing pattern.
- Document `/api/processes/:id/refresh` as the preferred process-detail entry point.
- Keep `/api/processes/sync` only as temporary compatibility.

### Phase 2: Harden job runtime

- Add heartbeat/renew.
- Add immediate failure reporting from the agent.
- Add retry metadata beyond `attempts`, for example `next_attempt_at` and policy reason.

### Phase 3: Improve observability

- Structured logs for enqueue, lease, ingest accepted, ingest failed, lease expired.
- Metrics for queue age, processing latency, failure rate by provider, and retry count.
- Operator dashboard for stuck leases and repeated failures.

### Phase 4: Backfill and rate limiting

- Introduce explicit sync modes: `live`, `backfill`, maybe `manual`.
- Add provider-aware concurrency/rate limiting.
- Add failure triage / dead-letter handling.

### Phase 5: Align architecture

- Extract cross-BC sync/read-model composition into a dedicated capability.
- Keep tracking BC as the only owner of canonical tracking semantics.

## Questions Still Open

- What maximum attempt count should convert a retried job into terminal failure or dead-letter?
- Should backfill share `sync_requests` or use a separate queue contract?
- Should provider rate limiting live in agent runtime, server queue policy, or both?
- Should sync observability be per-container, per-process, per-provider, or all three?
