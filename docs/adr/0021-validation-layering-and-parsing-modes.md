# ADR-0021 — Validation Layering and Parsing Modes (Canonical Acceptance vs Tolerant Parsing)

Status: Proposed  
Date: 2026-03-13  
Owner: Repository maintainers  
Related:
- `docs/TYPE_ARCHITECTURE.md`
- `docs/BOUNDARIES.md`
- `docs/TRACKING_INVARIANTS.md`
- `docs/TRACKING_EVENT_SERIES.md`
- `docs/ALERT_POLICY.md`
- `docs/ARCHITECTURE.md`
- ADR-0007 (Domain Truth Ownership)

---

## Context

The repository already defines layer boundaries and type transitions, but recurring ambiguity still appears in validation/parsing behavior across boundaries.

Observed hotspots:

- `src/modules/process/ui/validation/processApi.validation.ts` mixes request decode concerns with transport IO, cache, and endpoint orchestration.
- `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts` imports normalization from an application use case.
- `src/modules/process/ui/screens/shipment/lib/shipmentRefresh.status.ts` keeps response schema definitions inside `lib/`, mixing helper and boundary-contract concerns.

This ADR defines explicit parsing modes and layer constraints so we can keep deterministic domain truth while still handling hostile/incomplete external input.

---

## Decision

Validation and parsing are now formalized with four operational modes.

### 1) `canonical acceptance`

Owner:
- Domain and application invariants (owning bounded context)

Input:
- Already-decoded canonical contracts (entity/value-object/command/read-model contracts)

Behavior:
- Deterministic invariant enforcement
- No tolerant fallback
- Reject invalid semantic input explicitly

Failure:
- Domain/application error (never silent)

### 2) `boundary contract decode`

Owner:
- Interface HTTP (`modules/*/interface/http`)
- Shared transport contracts (`src/shared/api-schemas/*`)

Input:
- Request/response payloads at HTTP boundary

Behavior:
- Strict schema decode
- Fail fast on invalid contract
- Optional syntactic normalization is allowed only when contract-safe (for example trim/uppercase of textual fields)

Failure:
- 4xx contract error (request) or explicit decode error (response)

### 3) `tolerant external parsing`

Owner:
- Infrastructure integrations (carriers/external providers)

Input:
- Untrusted and inconsistent external payloads

Behavior:
- Best-effort parse is allowed
- Raw payload preservation is mandatory
- Uncertainty/conflict must remain explicit
- Tolerant parsing may downgrade to uncertainty signals, never to silent success

Failure:
- Explicit parse/normalization error path, or explicit uncertainty path

### 4) `UI permissive parsing`

Owner:
- UI form/query/storage/input parsing

Input:
- User free text, URL params, browser storage

Behavior:
- UX-oriented permissive parse and defaults are allowed
- UI may prepare transport input
- UI must not redefine canonical domain truth

Failure:
- Local UI feedback state (`loading | empty | error | ready` patterns remain explicit)

---

## Layer Rules

## Domain

Domain may:
- enforce canonical invariants
- reject semantically invalid state transitions

Domain must not:
- import transport schemas or HTTP DTO decoders
- depend on UI parsing helpers
- rely on tolerant parsing to accept invalid canonical state

## Interface HTTP

Interface HTTP must:
- decode request contracts strictly
- map DTO -> command/result -> DTO explicitly
- fail fast for invalid request contracts

Interface HTTP must not:
- hide decode failures behind tolerant fallback
- absorb operational policy unrelated to boundary translation

## UI

UI may:
- validate forms
- parse query params and storage values
- normalize user input for transport

UI must not:
- derive canonical status/timeline/alerts truth
- move transport orchestration into generic `*.validation.ts` files
- treat permissive parse as domain acceptance

## Infrastructure

Infrastructure may:
- parse provider payloads tolerantly
- decode persistence rows and map snake_case -> canonical contracts

Infrastructure must not:
- import wrong-layer helpers "for quick normalization"
- silence inconsistent payload shapes without explicit uncertainty/error handling
- mutate domain truth to fit parser convenience

---

## Explicit Prohibitions

- Domain depending on transport schemas.
- `*.validation.ts` files becoming adapter/orchestrator units.
- Tolerant parsing hiding inconsistencies.
- Infrastructure importing wrong-layer helpers to "normalize quickly".
- Mixing transport decode with operational policy in the same boundary adapter.

---

## Operational Placement

- Domain canonical validation:
  - `modules/<bc>/domain/*validation.ts` (or value-object factories)
- HTTP contract decode:
  - `modules/<bc>/interface/http/*.schemas.ts`
  - `src/shared/api-schemas/*.schemas.ts`
- UI permissive parsing:
  - `modules/<bc>/ui/validation/*`
- External/provider tolerant parsing:
  - `modules/tracking/infrastructure/carriers/schemas/**`
  - `modules/tracking/infrastructure/carriers/normalizers/**`
- Persistence row decode:
  - `modules/<bc>/infrastructure/persistence/*`

---

## Repository Examples (Current State)

Good direction:
- `src/modules/process/ui/validation/dashboardFilterQuery.validation.ts`
- `src/modules/process/ui/validation/dashboardSortStorage.validation.ts`
  - focused on query/storage parsing without transport orchestration.

Refactor targets under this ADR:
- `src/modules/process/ui/validation/processApi.validation.ts`
  - split API transport/caching concerns from validation concerns.
- `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts`
  - move container normalization dependency to a boundary-stable utility.
- `src/modules/process/ui/screens/shipment/lib/shipmentRefresh.status.ts`
  - keep response schema ownership in explicit boundary schema files.

---

## Consequences

Positive:
- clearer ownership of strict vs tolerant parsing behavior
- less cross-layer leakage
- better auditability of uncertainty/error paths

Tradeoff:
- more explicit files and mappings
- small migration/refactor cost in existing hotspots

This tradeoff is accepted to preserve deterministic domain truth and reliable boundary contracts.
