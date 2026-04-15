# AGENTS — Tracking (Local Addendum)

This file applies only to `src/modules/tracking/*`.

Primary instruction source:
- `AGENTS.md` (repository root)

This file contains only tracking-specific additions that are not already explicit in root.

---

## Sanity Gate Inheritance

For any commit-ready tracking change, follow the mandatory `pnpm sanity` close-out gate defined in root `AGENTS.md` section `11.1`.

This addendum does not relax or replace that gate.

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
- `deriveTimelineWithSeriesReadModel()` emits only series with a valid primary; a series containing only expired EXPECTED events is omitted, so test timestamps/`now` must reflect the intended visibility.
- For metadata-only additions on observations, add an A/B invariant regression using the same fixture with metadata present vs stripped (`null`) and assert timeline semantics, status derivation, and alert derivation are identical.

---

## 4) Search Projection Pattern

- For global search data (`vessel/status/eta`), derive values inside Tracking BC using tracking read models (`application/projection/tracking.search.readmodel.ts`), not in capabilities/UI.
- Use `observationRepository.listSearchObservations()` + tracking derivation (`deriveTimeline`/`deriveStatus`/operational summary) to keep status/ETA semantics canonical.
## 5) Alert & Observation Metadata Patterns

This section preserves two distinct but related concerns from both branches: alert read-model shaping and observation metadata propagation. Keep both rules; they target different layers and are complementary.

5.1 Alert read-model pattern

- `tracking_alerts` does not include `process_id`; when a tracking read model needs process ownership, enrich alert rows through infra repositories that resolve `container_id -> process_id`.
- `is_active` is derived from `acked_at === null`; expose it as derived read-model data, never as mutable source truth.
- If dashboard/capabilities need operational alert buckets (`eta | movement | customs | status | data`), keep the `TrackingAlert.type -> operational category` mapping inside tracking application projections (for example `tracking.operational-alert-category.readmodel.ts`) and let capabilities only aggregate rolls ups.

5.2 Observation metadata propagation pattern

- When adding provider metadata fields on observations (for example carrier labels), propagate them through the full chain:
  `normalizers -> ObservationDraft -> diffObservations -> persistence mappers -> TrackingObservationProjection -> tracking timeline read model`.
- Keep metadata out of semantic derivation inputs (status/series/alerts) unless a canonical domain rule explicitly requires it; metadata is primarily audit/UI context.
- For carrier semantic label mapping, normalize lookup keys (lowercase, trim, collapse spaces, remove diacritics) but keep `carrier_label` as the original provider text for audit/UI transparency.

*Note:* these rules are complementary: alerts are derived/read-model concerns; metadata propagation guarantees auditability and UI fidelity. Do not conflate read-model enrichment with core semantic derivation.
