# Tracking — Domain Invariants

This document defines non-negotiable invariants of Tracking bounded context.

---

## 1. Snapshot Immutability

Snapshots:

- Represent raw carrier payload
- Are immutable
- Are never updated in-place
- Are persisted before normalization

---

## 2. Observation Append-Only

Observations:

- Are derived from snapshots
- Are deduplicated via fingerprint
- Are never deleted
- Represent immutable facts

New data appends new observations.

## 2.1 Carrier Normalizer Invariants (MSC Hardening)

Carrier normalization must preserve semantic correctness before derivations.

For MSC feeds:

- `Full Transshipment Positioned In/Out` normalize to `TERMINAL_MOVE` (never `ARRIVAL`).
- `TERMINAL_MOVE` is operational-only and status-neutral by default.
- `vessel_name`/`voyage` extraction is limited to vessel-like events:
  - `LOAD`
  - `DISCHARGE`
  - `ARRIVAL`
  - `DEPARTURE`
- Placeholder values `LADEN` and `EMPTY` are never accepted vessel names.
- `raw_event.normalizer_version` is technical draft metadata for traceability and does not change persisted domain contracts.

Representative MSC description mapping (`MSC_DESCRIPTION_MAP`):

|MSC event label|Canonical observation type|
|---|---|
|Full Transshipment Loaded|LOAD|
|Full Transshipment Discharged|DISCHARGE|
|Full Transshipment Positioned In|TERMINAL_MOVE|
|Full Transshipment Positioned Out|TERMINAL_MOVE|

Normalized transshipment example:

```text
LOAD
DISCHARGE
TERMINAL_MOVE
TERMINAL_MOVE
LOAD
```

`TERMINAL_MOVE` observations remain operational facts and do not, alone, imply status progression.

---

## 3. Status is Derived

Container status:

- Is not stored truth
- Is derived from timeline
- Must be monotonic when possible

Status cannot regress unless domain rule explicitly allows.

---

## 4. Event History is Authoritative

Timeline is derived from full observation history.

system must tolerate:

- Missing intermediate events
- Out-of-order carrier emissions
- Multiple predictions
- Conflicting ACTUAL events

---

## 5. Idempotency

Fingerprint:

- Must be deterministic
- Must rely on semantic fields
- Must not rely solely on carrier event IDs

---

## 6. No Fact Deletion

system must never:

- Delete valid observations
- Rewrite historical event_time

Corrections are additive, not destructive.

---

## 7. UI Consumption Constraint

UI must consume tracking derivations canonical truth.

UI may:

- render timeline/status/alerts
- format and organize display for operator readability

UI must not:

- re-derive timeline/status/alerts
- reinterpret ACTUAL vs EXPECTED
- suppress conflicts to simplify presentation

Shipment view layout should remain timeline-first with supporting metadata in sidebar so chronological flow stays primary.
