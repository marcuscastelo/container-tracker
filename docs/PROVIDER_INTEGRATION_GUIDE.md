# Provider Integration Guide

This document explains how to add a new carrier/provider to Container Tracker without breaking domain invariants, sync orchestration, or UI boundaries.

Use this guide for:

- a new tracking-capable provider
- a new process/UI carrier label that may later become tracking-capable
- a provider refactor that changes fetchers, normalizers, or agent/runtime wiring

Read together with:

- `AGENTS.md`
- `src/modules/tracking/AGENTS.md`
- `docs/BOUNDARIES.md`
- `docs/TRACKING_INVARIANTS.md`
- `docs/TRACKING_EVENT_SERIES.md`
- `docs/SYNC_ARCHITECTURE_BOUNDARIES.md`
- `src/modules/tracking/README.md`

---

## 1) Non-Negotiable Rules

### 1.1 Preserve the canonical pipeline

Every provider must fit the same flow:

`Snapshot -> Observation -> Series -> Timeline -> Status -> Alerts`

Do not bypass this by:

- deriving status in the fetcher
- deriving timeline semantics in the UI
- persisting provider-specific DTOs as canonical truth

### 1.2 Keep ownership boundaries intact

- Provider HTTP/browser mechanics belong in tracking infrastructure.
- Canonical event semantics belong in Tracking BC.
- Capabilities may orchestrate sync, but must not redefine tracking meaning.
- UI may render labels and display states, but must not infer tracking truth.

### 1.3 Preserve auditability

- Raw payload must always be preserved.
- Snapshots are immutable.
- Observations are append-only.
- Unknown or partial provider data must degrade safely, not disappear silently.
- Provider opaque ids are metadata, not canonical identity.

---

## 2) Two Different Concepts: Process Carrier vs Tracking Provider

The repo has two related but distinct layers:

- `process` carrier: what users can select or view in shipment/process flows
- `tracking` provider: what the sync/agent pipeline can actually fetch and normalize

Important:

- A carrier may exist in process UI and still be non-trackable.
- A new tracking provider usually needs process/UI support too, but not always.
- If a provider is user-selectable in process forms, update process carrier catalogs and display labels.
- If a provider is sync-capable, update tracking provider registries, agent capabilities, schemas, and queue/migrations.

---

## 3) End-to-End Checklist

Use this as the canonical checklist.

### 3.1 Provider identity and registries

Add the provider string in the domain and every registry that gates sync behavior.

Typical files:

- `src/modules/tracking/domain/model/provider.ts`
- `src/modules/tracking/infrastructure/carriers/fetchers/is-rest-carrier.ts`
- `src/modules/tracking/infrastructure/carriers/fetchers/rest.fetchers.ts`
- `src/modules/tracking/features/observation/application/orchestration/normalizeSnapshot.ts`
- `src/capabilities/sync/application/ports/sync-queue.port.ts`
- `src/capabilities/sync/application/services/sync-target-resolver.service.ts`
- `src/capabilities/sync/application/usecases/refresh-process.usecase.ts`
- `src/modules/tracking/interface/http/refresh.schemas.ts`
- `src/modules/tracking/interface/http/agent-sync.schemas.ts`
- `src/modules/tracking/interface/http/agent-sync.controllers.ts`
- `src/modules/tracking/interface/http/agent-enroll.controllers.bootstrap.ts`
- `apps/agent/src/agent.ts`

If you miss one of these, the repo often compiles but the runtime breaks later with:

- unsupported provider errors
- agent targets never including the new provider
- fetch succeeding in one path but not in another

### 3.2 Provider fetcher

Create the provider fetcher in tracking infrastructure.

Typical location:

- `src/modules/tracking/infrastructure/carriers/fetchers/<provider>.fetcher.ts`

Rules:

- isolate headers, retries, timeouts, and provider quirks here
- validate external payloads at the boundary
- preserve original raw payload structure
- prefer explicit partial-failure handling over silent fallback
- return `parseError` for business/validation problems when the transport succeeded

If the provider is not REST-based, keep browser/scraping details isolated in infra too, following the Maersk pattern.

### 3.3 Provider schemas

Define explicit tolerant schemas for provider payloads.

Typical location:

- `src/modules/tracking/infrastructure/carriers/schemas/api/<provider>.api.schema.ts`

Rules:

- validate hostile external input with Zod
- keep provider DTOs in infra only
- do not leak raw DTO shapes into domain/application contracts
- prefer explicit snapshot contracts for multi-endpoint providers

### 3.4 Raw snapshot shape

If the provider uses multiple endpoints, persist a consolidated raw snapshot with all original payloads preserved.

Recommended pattern:

```json
{
  "provider": "<provider>",
  "search": {},
  "secondaryEndpoint": {},
  "events": {},
  "requestMeta": {},
  "endpointMeta": {}
}
```

Rules:

- keep endpoint payloads intact
- keep fetch metadata explicit
- do not collapse different endpoint semantics into one flattened DTO

### 3.5 Normalizer and mapping

Add a provider-specific normalizer and register it in `normalizeSnapshot()`.

Typical files:

- `src/modules/tracking/infrastructure/carriers/normalizers/<provider>.normalizer.ts`
- `src/modules/tracking/infrastructure/carriers/normalizers/<provider>.mapping.ts`
- `src/modules/tracking/infrastructure/carriers/normalizers/<provider>.temporal.ts`

Rules:

- emit canonical `ObservationDraft`s only
- keep provider-specific labels/ids as metadata for audit/UI
- centralize provider event mapping in one place
- centralize provider temporal parsing in one place
- prefer stable provider identifiers when available, with label-based validation as a secondary safeguard
- degrade unknown provider events safely instead of crashing the whole sync

Do not:

- invent canonical types that the domain does not own yet
- spread provider-specific parsing across multiple unrelated files
- use provider sequence numbers or opaque ids as the sole semantic identity

### 3.6 Observation metadata propagation

When adding provider metadata fields, propagate them through the full chain:

`normalizer -> ObservationDraft -> diff/persistence mappers -> projection/read model -> UI`

Do not make metadata fields part of semantic derivation unless the domain explicitly requires that.

### 3.7 Sync queue and agent runtime

A provider is not E2E until the agent/sync runtime knows how to lease, process, and ingest it.

Check:

- provider enum in HTTP schemas
- processable provider order
- agent default capabilities
- runtime provider dispatch in `apps/agent/src/agent.ts`
- queue/provider DB checks and paced scheduler SQL

Typical failure if this is incomplete:

- process refresh enqueues nothing
- agent never receives provider targets
- agent receives target but cannot scrape/fetch it

### 3.8 Container/process carrier consistency

If the user can edit the carrier on a process, container rows must remain aligned with that carrier when the domain expects provider-specific refresh by container.

Relevant files:

- `src/modules/process/application/usecases/update-process.usecase.ts`
- `src/modules/container/application/usecases/reconcile-containers.usecase.ts`
- `src/modules/container/application/usecases/update-container-carrier.usecase.ts`
- `src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts`

Rules:

- updating a process carrier must reconcile existing container carrier codes when appropriate
- refresh-by-container must validate provider/container coherence
- stale persisted carrier data should be healed or backfilled explicitly

Common failure mode:

- fetcher works, but refresh fails with provider mismatch because `containers.carrier_code` is stale

### 3.9 Database and migrations

New tracking providers usually need at least one migration.

Typical concerns:

- `sync_requests.provider` check constraints
- `tracking_agents.capabilities` backfill
- paced scheduler/provider whitelists
- container/process carrier backfills for existing rows

Example files:

- `supabase/migrations/2026040202_add_one_provider_support.sql`
- `supabase/migrations/2026040203_backfill_container_carriers_from_processes.sql`

Rules:

- do not rely only on code changes when persisted data already exists
- when runtime selection depends on stored provider/carrier codes, provide a backfill plan

### 3.10 Process/UI carrier catalogs

If the provider is user-visible in process management or global UI, update carrier display/catalog helpers too.

Typical files:

- `src/modules/process/interface/http/process.schemas.ts`
- `src/modules/process/ui/carrierCatalog.ts`
- `src/shared/utils/carrierDisplay.ts`
- `src/shared/utils/carrier.ts`

Potential UI touchpoints:

- create/edit process dialog
- shipment header/info cards
- dashboard tables
- search overlay
- external carrier tracking links

Important:

- UI label support is separate from tracking capability
- adding a provider only in backend is not E2E if the user cannot select or recognize it in the UI

---

## 4) Recommended Implementation Order

Use this order to avoid half-wired providers.

1. Add provider identity to domain/sync/runtime registries.
2. Create provider fetcher and schemas.
3. Define raw snapshot contract.
4. Implement normalizer, mapping, and temporal parsing.
5. Register the normalizer.
6. Wire agent/runtime dispatch and HTTP schemas.
7. Add migrations and backfills.
8. Update process/UI carrier catalogs if user-facing.
9. Add tests.
10. Smoke the real refresh/sync path end to end.

---

## 5) Testing Matrix

Provider work is only done when the E2E path is covered.

Minimum expectations:

### 5.1 Unit tests

- schema parsing
- fetcher validation/error handling
- event mapping
- temporal normalization
- fallback behavior for unknown or partial provider data

### 5.2 Integration tests

- raw snapshot to `ObservationDraft[]`
- expected actual-vs-expected behavior
- timeline/status/alerts remain canonical after provider data enters the system
- multi-endpoint reconciliation when applicable

### 5.3 Runtime/sync tests

- refresh and sync resolver paths accept the new provider
- agent target schemas accept the provider
- agent capability lists include the provider
- queue dedupe still works

### 5.4 UI tests

If the provider is user-facing:

- carrier dropdown/catalog exposes it
- display labels are stable
- search/dashboard/shipment views do not show broken raw codes unexpectedly

---

## 6) Common Failure Modes

### 6.1 Added in one union, missing in another

Symptom:

- provider accepted in one route but rejected in another

Fix:

- review every provider enum/union and registry

### 6.2 Fetcher works, runtime does not

Symptom:

- direct fetch succeeds locally, but agent never processes provider targets

Fix:

- update agent schemas, capabilities, processable provider order, and runtime dispatch

### 6.3 Snapshot is stored, but normalization never runs

Symptom:

- raw snapshot exists, no observations derived

Fix:

- register the provider in `normalizeSnapshot()`

### 6.4 Refresh mismatch caused by stale container carrier codes

Symptom:

- refresh fails with provider mismatch even though process carrier is correct

Fix:

- propagate carrier updates to containers
- add healing in refresh path where appropriate
- add DB backfill for existing rows

### 6.5 UI still shows unknown or missing provider

Symptom:

- backend supports provider, but form/dropdown/display still says unknown

Fix:

- update process carrier catalog, display labels, and tracking URL helpers

### 6.6 Provider-specific identifiers become accidental domain truth

Symptom:

- dedupe/status logic starts depending on opaque provider ids

Fix:

- move those fields back to metadata and restore semantic fingerprinting

---

## 7) Useful Search Commands

When adding a provider, these searches help find incomplete wiring:

```bash
rg -n "SupportedSyncProvider|ProviderSchema|AgentProviderSchema|PROCESSABLE_PROVIDER_ORDER" src tools
rg -n "is-rest-carrier|rest.fetchers|normalizeSnapshot|carrierCatalog|carrierDisplay|carrierTrackUrl" src
rg -n "provider in \\('|capabilities @>|target_provider" supabase/migrations
rg -n "msc|maersk|cmacgm|pil|one" src tools supabase
```

When validating a recent provider rollout, also search for a neighboring provider and compare touched surfaces. This is usually faster than guessing.

---

## 8) Reference Implementation: ONE

The ONE rollout is the best current reference because it touched all major layers:

- provider/domain/sync registries
- agent runtime and capabilities
- REST fetcher
- multi-endpoint raw snapshot contract
- provider schemas
- normalizer + mapping + temporal parsing
- queue/provider migrations
- process/container carrier consistency fixes
- UI carrier catalog and display labels
- unit, integration, and regression coverage

Representative files:

- `src/modules/tracking/infrastructure/carriers/fetchers/one.fetcher.ts`
- `src/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema.ts`
- `src/modules/tracking/infrastructure/carriers/normalizers/one.normalizer.ts`
- `src/modules/tracking/infrastructure/carriers/normalizers/one.mapping.ts`
- `src/modules/tracking/infrastructure/carriers/normalizers/one.temporal.ts`
- `supabase/migrations/2026040202_add_one_provider_support.sql`
- `supabase/migrations/2026040203_backfill_container_carriers_from_processes.sql`

---

## 9) Final Pre-PR Checklist

Before opening the PR, confirm:

- raw payload is preserved
- provider is registered everywhere it must be
- normalizer is wired
- agent/runtime can process it
- DB constraints and backfills exist if needed
- UI catalogs are updated if user-facing
- tests cover fetcher, schemas, normalization, sync, and user-visible display
- mandatory close-out `pnpm sanity` gate was executed (see `AGENTS.md` section `11.1`)
- initial vs final `pnpm sanity` state (delta) was recorded with explicit no-regression confirmation
- no domain semantics leaked into capabilities or UI

If any answer is "not sure", stop and compare with the ONE implementation before merging.
