# AGENTS — Tracking (Local Addendum)

This file applies only to `src/modules/tracking/*`.

Primary instruction source:
- `AGENTS.md` (repository root)

This file contains only tracking-specific additions that are not already explicit in root.

---

## 0) Read-First for Tracking Changes

- `docs/TRACKING_INVARIANTS.md`
- `docs/TRACKING_EVENT_SERIES.md`
- `docs/ALERT_POLICY.md`
- `docs/BOUNDARIES.md`
- `docs/TYPE_ARCHITECTURE.md`

---

## 1) Tracking Ownership

Tracking owns:
- snapshot persistence (raw payload)
- normalized observations
- timeline/status/alert derivation
- series reconciliation/classification
- carrier integration (fetchers + normalizers)

No other module should redefine tracking semantics.

---

## 2) Invariants to Protect in This Module

- Always preserve raw payload, even when parsing fails
- Parsing failures must surface as `data` alerts (do not hide)
- `domain/derive/*` must stay pure and deterministic (no presentation logic, no implicit `now`)
- Reconcile layer classifies; it never mutates facts
- One semantic series must produce one timeline primary
- Conflict in multiple ACTUAL must remain visible

---

## 3) Tests Required on Sensitive Changes

If changing:
- fingerprint logic -> update/add tests under tracking domain identity/tests
- series classification/expiration -> update `domain/reconcile/tests/*`
- timeline derivation -> update derive/reconcile read-model tests

Prefer deterministic fixtures and stable tests.

---

## 4) Search Projection Pattern

- For global search data (`vessel/status/eta`), derive values inside Tracking BC using tracking read models (`application/projection/tracking.search.readmodel.ts`), not in capabilities/UI.
- Use `observationRepository.listSearchObservations()` + tracking derivation (`deriveTimeline`/`deriveStatus`/operational summary) to keep status/ETA semantics canonical.

## 5) Observation Metadata Propagation Pattern

- When adding provider metadata fields on observations (for example carrier labels), propagate through the full chain:
  `normalizers -> ObservationDraft -> diffObservations -> persistence mappers -> TrackingObservationDTO -> tracking timeline read model`.
- Keep metadata out of semantic derivation inputs (status/series/alerts) unless a canonical domain rule explicitly requires it.
