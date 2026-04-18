# Container Tracker — Product & Domain Master (v2)

This document defines **product vision and canonical domain model**.

It is NOT responsible for:

- Layering rules (see TYPE_ARCHITECTURE.md)
- BC dependency rules (see BOUNDARIES.md)
- Event series specification (see TRACKING_EVENT_SERIES.md)
- Tracking invariants (see TRACKING_INVARIANTS.md)
- Alert behavior specification (see ALERT_POLICY.md)
- Detailed UI composition and visual language (see UI_PHILOSOPHY.md)

This document defines:

- Product intent
- Core domain concepts
- Canonical states
- Canonical event types
- High-level operational principles

---

# 1. Product Vision

Container Tracker is operational maritime tracking panel.

Its purpose is:

- Consolidate heterogeneous carrier APIs
- Normalize inconsistent tracking data
- Preserve full historical audit trail
- Detect operational exceptions early
- Present reliable, explainable state to operators

system prioritizes:

- Determinism
- Auditability
- Transparency of uncertainty
- Exception visibility over visual minimalism
- Timeline-first operational comprehension
- High information density with clear hierarchy

---

# 2. Core Domain Model

## 2.1 Process (Shipment)

Represents logical shipment grouping.

Contains:

- Reference
- Origin
- Destination
- Carrier
- Containers[]

Process does not own tracking logic.
Tracking is delegated to Tracking BC.

---

## 2.2 Container

Represents physical container.

Contains:

- Container number
- Carrier code
- Association to Process

Container does not:

- Derive status
- Derive alerts
- Derive timeline

---

## 2.3 Tracking

Tracking is event-driven.

Core flow:

Snapshot → Observation → Derivation

Tracking owns:

- Snapshot ingestion
- Observation normalization
- Timeline derivation
- Status derivation
- Alert derivation
- Series classification

Tracking never deletes facts.

---

# 3. Snapshot Model

Snapshot:

- Represents raw carrier payload
- Is immutable
- Is stored before normalization
- Is preserved for audit

Snapshots are never modified or overwritten.

---

# 4. Observation Model

Observation:

- Is normalized fact derived from Snapshot
- Is idempotent (via fingerprint)
- Is immutable
- Is append-only

Observations are canonical historical truth.

---

# 5. Canonical Event Types

Events represent semantic logistics milestones.

Examples:

- GATE_IN
- GATE_OUT
- LOAD
- DEPARTURE
- ARRIVAL
- DISCHARGE
- TERMINAL_MOVE
- DELIVERY
- EMPTY_RETURN
- CUSTOMS_HOLD
- CUSTOMS_RELEASE

Events are facts, not states.

`TERMINAL_MOVE` represents internal terminal-yard handling (for example positioned in/out).
It preserves operational truth but does not, by itself, advance container lifecycle status.

### 5.1 Transshipment Example (Operationally Realistic)

Typical transshipment sequence may include:

- LOAD
- DISCHARGE
- TERMINAL_MOVE
- TERMINAL_MOVE
- LOAD

`TERMINAL_MOVE` keeps yard operations visible without being reinterpreted ARRIVAL/DEPARTURE.

---

# 6. Event Time Types

Each event has:

- ACTUAL
- EXPECTED

ACTUAL represents confirmed milestone.
EXPECTED represents predicted milestone.

Series grouping and classification are defined in:
TRACKING_EVENT_SERIES.md

---

# 7. Canonical Container Statuses

Container status is derived from observations.

Examples:

- BOOKED
- GATE_IN
- LOADED_ON_VESSEL
- IN_TRANSIT
- ARRIVED_AT_POD
- DISCHARGED
- DELIVERED
- EMPTY_RETURNED
- UNKNOWN

Status is derived — never manually assigned.

---

# 8. Alerts

Alerts are derived from facts and operational conditions.

Categories:

- eta
- movement
- customs
- status
- data

Alert behavior is formally defined in:
ALERT_POLICY.md

---

# 9. Operational Principles

1. History is preserved.
2. Facts are append-only.
3. Derived views are reproducible.
4. Conflicts are exposed, not hidden.
5. UI must not redefine domain truth.
6. Uncertainty must be visible.
7. Shipment view is timeline-first; supporting metadata stays in sidebar panels.
8. Operational grouping in timeline remains explicit when provided by canonical read models.

---

# 10. What This Document Does NOT Define

- Layering contracts
- Repository contracts
- DTO mapping rules
- Dependency boundaries
- UI rendering logic
- Infrastructure details

Those are defined in dedicated documents.

---

# 11. Architectural Cross-References

For full specification:

- Architecture overview → ARCHITECTURE.md
- Type & layer rules → TYPE_ARCHITECTURE.md
- BC vs capability boundaries → BOUNDARIES.md
- Tracking invariants → TRACKING_INVARIANTS.md
- Event series model → TRACKING_EVENT_SERIES.md
- Alert policy → ALERT_POLICY.md
- UI philosophy → UI_PHILOSOPHY.md

---

This file is canonical product-level domain description.
All technical enforcement rules live in their respective specification documents.
