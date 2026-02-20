# Agent Instructions — Tracking Bounded Context

This file applies to changes under `src/modules/tracking/*`.

Tracking owns:
- snapshots (raw payload)
- observations (normalized events)
- derivation (timeline/status/alerts)
- series classification and reconciliation
- carrier integration (fetchers + normalizers)

---

## 0) Read-first (mandatory for tracking edits)

- `docs/TRACKING_INVARIANTS.md`
- `docs/TRACKING_EVENT_SERIES.md`
- `docs/ALERT_POLICY.md`
- `docs/BOUNDARIES.md`
- `docs/arquitetura_de_tipos_e_camadas_container_tracker_guia_definitivo-0211.md`

---

## 1) Non-negotiable invariants

### 1.1 Snapshots are immutable
- Always persist raw payload first
- Never overwrite or update snapshots in-place

### 1.2 Observations are append-only
- Never delete or mutate an observation
- Corrections are additive
- Deduplicate via deterministic fingerprint (semantic fields)

### 1.3 Raw payload is preserved
- Never discard raw
- Parsing failures must be visible (data alert) while keeping raw

---

## 2) Series semantics (must not regress)

### Fundamental Rule:
ONE series → ONE timeline entry.

Never produce multiple timeline entries for the same semantic series.

---

### Primary selection (Safe-First)

If series contains:

- Any ACTUAL → primary = latest ACTUAL.
- No ACTUAL → primary = latest valid EXPECTED.

Older EXPECTED events:

- Must remain in history.
- Must NOT generate additional timeline entries.
- Must be exposed only via `series[]` for inspection.

EXPECTED after ACTUAL:

- Preserved as fact.
- Marked redundant for display.
- Never replaces ACTUAL.

Multiple ACTUAL in a series:

- Preserve all facts.
- Mark series as conflicted.
- Primary = latest ACTUAL.
- Emit data alert.

---

### Expiration

EXPIRED_EXPECTED is:

- A derived display state.
- Computed in reconcile layer.
- Never a mutation of the original observation.

---

## 3) What Tracking must NOT do

- Must NOT format dates for locale
- Must NOT generate UI labels or i18n strings
- Must NOT depend on UI components
- Must NOT import capabilities
- Must NOT leak transport DTOs as domain types (prefer internal DTOs/read models)

---

## 4) Alert rules (tracking-specific)

- Fact alerts may be retroactive
- Monitoring alerts must not be retroactive
- Conflicts and parsing issues should produce `data` category alerts

---

## 5) Layering & types rules

- domain: pure rules and types, no infra or UI
- application: orchestration + read models + ports
- infrastructure: persistence + carrier integration
- interface: HTTP mapping/controllers
- UI only consumes read models

No:
- `any`
- `as` (except `as const`)
- `Partial<Entity>` inputs
- `{ success: boolean }` results

snake_case restricted to persistence.

---

## 6) Tests required for sensitive changes

If you change:
- fingerprinting → add/adjust tests in `domain/tests/*` and/or `domain/identity/*`
- series classification / expiration → update tests in `domain/reconcile/tests/*`
- timeline derivation → update tests in `domain/tests/deriveTimeline*` and presenter/read model tests

Prefer deterministic fixtures and golden tests.
