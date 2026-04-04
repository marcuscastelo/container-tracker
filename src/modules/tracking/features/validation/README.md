# Tracking Validation Plugin Framework

This slice owns pluginable tracking validation detection inside the Tracking BC.

It exists to answer:

> Is the system currently lacking enough confidence in its own tracking interpretation?

It does not create a new status, rewrite facts, or move semantics to UI/capabilities.

## Where Things Live

- Domain contracts: `domain/model/*`
- Detectors: `domain/detectors/*`
- Registry: `domain/registry/trackingValidationRegistry.ts`
- Aggregation/lifecycle services: `domain/services/*`
- Compact projection for application/read models: `application/projection/trackingValidation.projection.ts`

## Active Detectors

- `CONFLICTING_CRITICAL_ACTUALS`
- `POST_COMPLETION_TRACKING_CONTINUED`
- `CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT`
- `CANONICAL_TIMELINE_SEGMENT_DUPLICATED`
- `EXPECTED_PLAN_NOT_RECONCILABLE`
- `MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT`

These detectors are the agreed V1-V1.2 set. Final polish phases must keep them on the same registry path instead of opening any parallel wiring.

## Contract Ownership By Layer

- Domain-only detector output: `TrackingValidationFinding`
- Application/read-model display contract: `TrackingValidationDisplayIssue`
- HTTP/UI consume only compact summaries derived from the application projection

`TrackingValidationDisplayIssue` is intentionally not a detector/domain contract. It exists to expose compact product-safe explanation metadata without leaking detector internals across BC boundaries.

## Detector Conventions

- Add one detector per file in `domain/detectors/`.
- Register it explicitly in `domain/detectors/trackingValidationDetectors.ts`.
- `detectorId` and `code` must be the same value.
- `detectorId` and `code` must use `UPPER_SNAKE_CASE`.
- `summaryKey` must stay under `tracking.validation.*`.
- `detectorVersion` must be explicit and stable for the detector implementation.
- `affectedScope` must stay conservative.
  If a new persisted scope is needed, add detector + code + DDL in the same phase.

## Finding Contract

Every detector returns `TrackingValidationFinding`.

Important fields:

- `evidenceSummary`: short, product-safe, lifecycle-safe summary text
- `debugEvidence`: technical internal detail for troubleshooting only
- `lifecycleKey`: stable issue identity owned by the detector
- `stateFingerprint`: stable detector-owned fingerprint for transition tracking

Rules:

- `evidenceSummary` must stay short and safe for controlled product surfaces.
- `debugEvidence` must not cross into dashboard, shipment DTOs, shipment VMs, or time travel DTOs.
- `debugEvidence` must not be persisted in lifecycle transitions in this V1 framework.
- `isActive` controls aggregation; inactive findings may still exist internally for audit/debug flows.

## Severity Guidance

- Use `ADVISORY` when the reading is suspicious but still plausibly usable.
- Use `CRITICAL` when there is a strong chance the current tracking interpretation is dangerously wrong.
- Do not escalate severity for visual emphasis alone.
- Severity is domain-owned. UI only maps the compact severity already derived.

## Affected Scope Guidance

Use the narrowest scope that remains semantically true.

Current persisted scopes are intentionally conservative:

- `CONTAINER`
- `OPERATIONAL`
- `PROCESS`
- `SERIES`
- `STATUS`
- `TIMELINE`

Do not invent new scopes in UI or capability code.

## What Is Forbidden

- Deriving validation issues in UI, capability, route, or dev preview code
- Bypassing the registry with ad hoc detector execution
- Persisting debug payloads or raw snapshots as validation lifecycle state
- Hiding conflicting facts to reduce noise
- Turning this slice into a generic rules engine or shared kernel

## How To Add a Detector

1. Create a new detector file in `domain/detectors/`.
2. Use only `TrackingValidationContext` and tracking-owned canonical data.
3. Return findings with:
   - `detectorId === code`
   - stable `lifecycleKey`
   - stable `stateFingerprint`
   - safe `evidenceSummary`
   - optional `debugEvidence`
4. Register the detector in `domain/detectors/trackingValidationDetectors.ts`.
5. Add detector unit tests.
6. Add regression coverage for aggregation and non-leak where relevant.

## Testing Expectations

- Detector positive and negative paths
- Registry convention enforcement
- Aggregation remains compact
- DTO/VM non-leak of `debugEvidence`
- Existing detectors keep working after contract changes

## Boundary Reminder

- Tracking owns validation semantics.
- Application/read models may expose only compact summaries.
- HTTP exposes only compact DTOs.
- UI consumes `Response DTO -> ViewModel` and never re-derives validation truth.
