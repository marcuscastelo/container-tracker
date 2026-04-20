# UBIQUITOUS_LANGUAGE

## Purpose

This document defines canonical ubiquitous language of Container Tracker.

It exists to:
- eliminate semantic drift across modules, capabilities, and UI
- enforce consistent naming in code, PRDs, ADRs, and UI
- preserve architectural boundaries through precise terminology

This document is normative for terminology only.

---

## Rules

1. Each term has one primary meaning.
2. Avoid synonyms in code — prefer canonical names.
3. If term is ambiguous, it must be explicitly qualified.
4. UI labels may differ, but must map to canonical terms.
5. Each concept belongs to bounded context.
6. This document defines vocabulary, not behavior.

---

## Canonical Terms

|Term|Definition|Owned by|Layer|Aliases to avoid|
| --------------------- | ----------------------------------------------------------- | -------------------- | ------------ | ------------------------ |
|Process|Logical shipment grouping|process|Domain|shipment (internal), job|
|Container|Physical shipping container linked to process|container|Domain|unit, box|
|Snapshot|Raw immutable carrier payload|tracking|Ingestion|event, raw event|
|Observation|Normalized immutable fact derived from snapshot|tracking|Domain|event|
|Milestone|Semantic logistics checkpoint (e.g. LOADED_ON_VESSEL)|tracking|Domain|event|
|Series|Group of observations for same milestone|tracking|Domain|event group|
|Timeline|Chronological derived view combining multiple series|tracking|Read model|history, events|
|Primary (Observation)|Selected observation representing series|tracking|Derived|latest|
|ACTUAL|Confirmed occurrence of milestone|tracking|Domain|real|
|EXPECTED|Predicted occurrence of milestone|tracking|Domain|estimate|
|Active Expected|Most recent valid EXPECTED in series|tracking|Derived|current estimate|
|Expired Expected|EXPECTED no longer valid due to time progression|tracking|Derived|outdated|
|Redundant|Observation no longer relevant (e.g. EXPECTED after ACTUAL)|tracking|Derived|duplicate|
|Conflict|Multiple ACTUAL observations within series|tracking|Derived|inconsistency|
|Status|Derived operational state from timeline|tracking / process|Derived|state, phase|
|Alert|Derived operational signal|tracking|Derived|warning, issue|
|Read Model|Projection optimized for reading|capability / backend|Read model|view|
|Response DTO|Backend HTTP contract|backend|Transport|response|
|ViewModel|UI render model|UI|Presentation|model|
|Timeline Item|UI representation of timeline data|UI|Presentation|event|
|Capability|Cross-BC orchestration layer|capabilities|Application|service|
|Bounded Context|Semantic ownership boundary|architecture|Structural|module|

---

## Disambiguation

### Event

“Event” is not canonical term and should be avoided.

It may refer to:
- Observation (data)
- Milestone (type)
- Timeline Item (UI)

Use precise terms instead.

---

### Status

Must always be qualified when used.

- Container status
- Process status
- Sync status (runtime)

Status is always derived.

---

### Series vs Timeline

- Series groups observations of same milestone
- Timeline combines multiple series into chronological view

Timeline is not series.

---

## Naming Rules (Code)

Prefer:
- Observation
- Milestone
- Series
- Timeline
- Primary
- DerivedStatus

Avoid:
- event
- data
- info
- implicit naming

---

## When Adding New Terms

new term must define:
- definition
- owned bounded context
- layer
- forbidden aliases

If ambiguity exists, update this document before merging code.

---

## Source Alignment

This document must stay aligned with:

- MASTER_v2.md
- DOMAIN.md
- TRACKING_INVARIANTS.md
- TRACKING_EVENT_SERIES.md
- ARCHITECTURE.md
- TYPE_ARCHITECTURE.md
- BOUNDARIES.md
- UI_PHILOSOPHY.md
- ALERT_POLICY.md