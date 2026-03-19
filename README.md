# Container Tracker

Operational maritime tracking platform focused on **determinism, auditability, and timeline-first visibility**.

---

# 1. Overview

Container Tracker consolidates heterogeneous carrier data and transforms it into a **reliable, explainable operational timeline**.

The system:

- Ingests raw carrier data (snapshots)
- Normalizes into canonical observations
- Derives timeline, status, and alerts deterministically
- Preserves full historical audit trail
- Surfaces operational exceptions early

> The system prioritizes correctness and auditability over convenience.

Reference:
- :contentReference[oaicite:0]{index=0}

---

# 2. Core Principles

## 2.1 Domain Truth

All domain truth is derived **only inside bounded contexts**, primarily `tracking`.

Pipeline:

```
Snapshot → Observation → Timeline → Status → Alerts
```

- Snapshots are immutable
- Observations are append-only
- Status is derived (never stored)
- Alerts are derived and idempotent

Reference:
- :contentReference[oaicite:1]{index=1}

---

## 2.2 Determinism

Given the same observations:

- timeline is deterministic
- status is deterministic
- alerts are deterministic

No layer may reinterpret or override domain results.

---

## 2.3 Auditability

- No fact is deleted
- No history is rewritten
- Conflicts are exposed, not hidden

Reference:
- :contentReference[oaicite:2]{index=2}

---

## 2.4 Timeline-First UX

Shipment view is **timeline-first**.

- Chronology is the primary artifact
- Metadata is secondary (sidebar)
- Grouped operational blocks must be preserved

Reference:
- :contentReference[oaicite:3]{index=3}

---

# 3. Domain Model

## 3.1 Process (Shipment)

Logical grouping of containers.

Contains:

- reference
- origin / destination
- containers[]

Does **not** own tracking logic.

---

## 3.2 Container

Represents a physical container.

Contains:

- container number
- carrier code

Does **not** derive:

- timeline
- status
- alerts

---

## 3.3 Tracking (Core Domain)

Event-driven domain responsible for:

- snapshot ingestion
- observation normalization
- event-series grouping
- timeline derivation
- status derivation
- alert derivation

Reference:
- :contentReference[oaicite:4]{index=4}

---

# 4. Event Model

## 4.1 Observations

Normalized facts derived from snapshots.

Fields:

- type
- location
- event_time
- event_time_type: ACTUAL | EXPECTED

Properties:

- immutable
- append-only
- idempotent (fingerprint)

---

## 4.2 Event Series

Observations are grouped into **series** (semantic milestones).

Example:

```
EXPECTED LOAD
EXPECTED LOAD (update)
ACTUAL LOAD
```

All belong to the same series.

---

## 4.3 Safe-First Rule

Primary event selection:

1. If ACTUAL exists → latest ACTUAL
2. Else → latest active EXPECTED

---

## 4.4 Derived States

- ACTUAL
- ACTIVE_EXPECTED
- EXPIRED_EXPECTED

EXPECTED after ACTUAL = redundant

Conflicts (multiple ACTUAL) must be exposed.

Reference:
- :contentReference[oaicite:5]{index=5}

---

# 5. Container Status

Status is derived from timeline.

Examples:

- BOOKED
- GATE_IN
- LOADED_ON_VESSEL
- IN_TRANSIT
- ARRIVED_AT_POD
- DELIVERED
- EMPTY_RETURNED

Rules:

- never stored as truth
- monotonic when possible

Reference:
- :contentReference[oaicite:6]{index=6}

---

# 6. Alerts

Alerts are derived from domain state.

Categories:

- eta
- movement
- customs
- status
- data

Types:

- Fact alerts → based on history
- Monitoring alerts → based on "now"

Properties:

- idempotent
- deterministic
- never suppress facts

Reference:
- :contentReference[oaicite:7]{index=7}

---

# 7. Architecture

## 7.1 Structure

```
src/
  modules/        # Bounded Contexts (source of truth)
  capabilities/   # Cross-BC orchestration
  routes/         # Thin adapters
  shared/         # Infra/utilities only
```

Reference:
- :contentReference[oaicite:8]{index=8}

---

## 7.2 Bounded Contexts

- process
- container
- tracking

Rules:

- BC owns its domain
- no cross-BC domain imports
- domain never depends on UI or HTTP

Reference:
- :contentReference[oaicite:9]{index=9}

---

## 7.3 Capabilities

Capabilities:

- orchestrate multiple BCs
- compose read models
- do NOT define domain rules

Example:

```
capabilities/sync
```

Reference:
- :contentReference[oaicite:10]{index=10}

---

## 7.4 Type Architecture (Mandatory)

Each boundary changes type:

```
Row → Entity → Result → Response DTO → ViewModel
```

Rules:

- Entity is backend-only
- UI never consumes Entity
- Repository returns Entity and throws errors

Reference:
- :contentReference[oaicite:11]{index=11}

---

# 8. UI Architecture

## 8.1 Shipment Screen

Canonical layout:

```
Main:
  - Container selector
  - Timeline

Sidebar:
  - Shipment info
  - Current status
  - Alerts
```

Rules:

- timeline is primary
- sidebar supports, never interrupts

---

## 8.2 UI Responsibilities

UI may:

- map DTO → ViewModel
- format dates / labels
- handle interaction

UI must NOT:

- derive timeline
- derive status
- derive alerts
- reinterpret ACTUAL vs EXPECTED

Reference:
- :contentReference[oaicite:12]{index=12}

---

# 9. Tracking Pipeline

```
Carrier API
   ↓
Snapshot (immutable)
   ↓
Observation (normalized)
   ↓
Series (grouped)
   ↓
Timeline (derived)
   ↓
Status (derived)
   ↓
Alerts (derived)
```

---

# 10. Operational Guarantees

- append-only history
- deterministic derivation
- explicit conflict visibility
- no hidden corrections
- explainable state at any point in time

---

# 11. Non-Goals

The system does NOT:

- mutate historical facts
- simplify timeline to “last event”
- hide inconsistencies
- derive domain truth in UI
- centralize domain logic in shared/

---

# 12. Development Guidelines

## Must

- respect BC boundaries
- keep domain logic inside tracking
- use explicit mappers between layers
- preserve auditability

## Must NOT

- use `Partial<Entity>`
- re-derive status in UI
- create implicit shared kernel
- flatten timeline semantics

---

# 13. Key References

- Product & Domain → `docs/MASTER_v2.md`
- Architecture → `docs/ARCHITECTURE.md`
- Type System → `docs/TYPE_ARCHITECTURE.md`
- Boundaries → `docs/BOUNDARIES.md`
- Tracking Invariants → `docs/TRACKING_INVARIANTS.md`
- Event Series → `docs/TRACKING_EVENT_SERIES.md`
- Alert Policy → `docs/ALERT_POLICY.md`
- UI Philosophy → `docs/UI_PHILOSOPHY.md`

---

# 14. Summary

Container Tracker is:

- event-driven
- append-only
- deterministic
- audit-first
- timeline-first

> The domain defines truth.  
> The UI exposes it.  
> Nothing else is allowed to reinterpret it.