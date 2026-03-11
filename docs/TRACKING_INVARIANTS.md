# Tracking — Domain Invariants

This document defines non-negotiable invariants of the Tracking bounded context.

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

---

## 3. Status is Derived

Container status:

- Is not stored as truth
- Is derived from timeline
- Must be monotonic when possible

Status cannot regress unless domain rule explicitly allows.

---

## 4. Event History is Authoritative

Timeline is derived from full observation history.

The system must tolerate:

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

The system must never:

- Delete valid observations
- Rewrite historical event_time

Corrections are additive, not destructive.

---

## 7. UI Consumption Constraint

UI must consume tracking derivations as canonical truth.

UI may:

- render timeline/status/alerts
- format and organize display for operator readability

UI must not:

- re-derive timeline/status/alerts
- reinterpret ACTUAL vs EXPECTED
- suppress conflicts to simplify presentation

Shipment view layout should remain timeline-first with supporting metadata in sidebar so chronological flow stays primary.
