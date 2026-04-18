# Tracking — Event Series Model (Formal Specification)

## 1. Motivation

Carrier APIs frequently:

- Update predicted dates multiple times
- Replace old predictions
- Emit ACTUAL events after multiple EXPECTED updates
- Occasionally duplicate ACTUAL events

The system must:

- Preserve full history
- Display only one “primary” event per semantic step
- Avoid confusing the operator
- Remain explainable

This document formalizes the Event Series model.

---

## 2. Core Concepts

### Observation

A normalized fact derived from snapshot ingestion.

Key fields:

- type
- location
- event_time
- event_time_type: ACTUAL | EXPECTED

Observations are immutable and append-only.

### Observation Type Nuance: `TERMINAL_MOVE`

`TERMINAL_MOVE` is a canonical observation type for internal terminal operations
(for example positioned in/out during transshipment).

Rules:

- It is preserved as fact in timeline history.
- It is status-neutral by default (does not advance lifecycle stage by itself).
- It must not be promoted to ARRIVAL/LOAD by UI interpretation.

---

### Series

A **Series** is a group of Observations referring to the same semantic milestone.

Series key is derived from:

(type + semantic location grouping rules)

Example:

- LOAD at port A
- Multiple EXPECTED LOAD updates
- Later ACTUAL LOAD

All belong to one series.

---

## 3. Valid Series Shapes

A series may contain:

1. Single ACTUAL
2. Single EXPECTED
3. Multiple EXPECTED
4. Multiple EXPECTED + 1 ACTUAL
5. Multiple ACTUAL (conflict)
6. EXPECTED after ACTUAL (redundant)

---

## 4. Primary Selection (Safe-First Rule)

Algorithm:

1. If any ACTUAL exists:
   - Select the latest observed ACTUAL as primary.
   - "Latest observed" means observation recency (`created_at`/observed-at), not
     the largest ACTUAL event date.
   - If ACTUAL observed-at ties, use `event_time` as deterministic secondary
     tiebreak.
2. Else:
   - Select the latest observed EXPECTED revision as primary only while it is non-expired.
   - "Latest observed" means observation recency (`created_at`/observed-at), not
     the largest predicted event date.
   - Do not fall back to an older EXPECTED revision just because it has a later
     predicted event date.

This ensures monotonic correctness and operator safety.

---

## 5. Derived States

Each observation is classified as:

- ACTUAL
- ACTIVE_EXPECTED
- EXPIRED_EXPECTED

Rules:

- EXPECTED becomes EXPIRED if:
  - event_time < now
  - and no ACTUAL supersedes it
- EXPECTED after ACTUAL is REDUNDANT (hidden by default)

---

## 6. Conflict Handling

If multiple ACTUAL events exist in one series:

- Latest observed ACTUAL is primary
- Series marked as conflicted
- Data alert may be emitted

System must never discard conflicting ACTUAL facts.

---

## 7. UI Contract

Tracking exports:

- TrackingTimelineItem
- deriveTimelineWithSeriesReadModel()

Tracking does NOT:

- Generate labels
- Format dates
- Perform i18n

UI decides presentation with boundary constraints:

- UI may format and visually group provided read-model data.
- UI must not recalculate primary selection or series classification.
- Shipment view should keep chronology as primary (timeline-first) and keep supporting metadata in sidebar panels.
- When timeline read models expose operational grouping (for example voyage/transshipment blocks), UI should preserve that grouping instead of flattening into a generic event list.

Reference:

- `docs/UI_PHILOSOPHY.md`

---

## 8. Transshipment Timeline Example

A realistic transshipment sequence may appear as:

- DISCHARGE (vessel A)
- TERMINAL_MOVE
- TERMINAL_MOVE
- LOAD (vessel B)

`TERMINAL_MOVE` preserves operational fidelity between discharge/reload without changing status progression rules.
