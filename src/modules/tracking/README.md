# Tracking Module (Bounded Context)

## Responsibilities

- Snapshot persistence
- Observation normalization
- Timeline derivation
- Alert derivation
- Event series classification

---

## Pipeline (Operational Summary)

1. Persist raw carrier payload Snapshot (immutable).
2. `normalizeSnapshot(snapshot)` → `ObservationDraft[]` (provider-specific).
3. `diffObservations(existing, drafts)` → new `Observation[]` (idempotent via fingerprint).
4. Persist new Observations.
5. Derive read models (timeline/status/alerts) from full observation history.
6. Persist derived alerts (fact-based and monitoring).
7. Never delete history; append-only facts.

---

## Timeline Contract (Updated)

Tracking exposes:

- `TrackingTimelineItem`
- `deriveTimelineWithSeriesReadModel()`

Tracking guarantees:

- Correct chronological ordering
- Safe-first primary selection (series classification)
- Correct derived state classification (`ACTUAL`, `ACTIVE_EXPECTED`, `EXPIRED_EXPECTED`)

Tracking does NOT:

- Generate final UI labels
- Format locale-specific dates
- Perform translation/i18n

UI (currently `process/ui`) is responsible for mapping:
- `type` → label/i18n key
- ISO timestamps → localized display strings

---

## Key Types

- `Snapshot` — `domain/model/snapshot.ts`
- `ObservationDraft` — `domain/model/observationDraft.ts`
- `Observation` — `domain/model/observation.ts`
- `ContainerStatus` — `domain/model/containerStatus.ts`
- `TrackingAlert` — `domain/model/trackingAlert.ts`
- Series logic — `domain/reconcile/*`

---

## Rules / Pitfalls

- External carrier ordering/timestamps are not trusted; normalize deterministically.
- Avoid retroactive monitoring alerts; only fact alerts may be retroactive (and must be flagged).
- Do not delete observations; new facts are appended.
- Fingerprint collisions: prefer persisting both and raising `data` alert.

---

## Where To Look

- Ingestion/orchestration: `application/orchestration/pipeline.ts`
- Normalizers/fetchers: `infrastructure/carriers/*`
- Timeline read model: `application/projection/tracking.timeline.readmodel.ts`
- Validation plugin framework: `features/validation/README.md`
- Domain tests: `domain/tests/*`
