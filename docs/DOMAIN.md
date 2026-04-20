# Container Tracker — Domain Model

## 1. Core Entities

### Process (Shipment)
Represents logical shipment grouping.

Owns:
- Reference
- Origin / Destination
- Carrier
- Containers[]

Derived:
- Operational summary
- Aggregated status

---

### Container
Physical shipping container.

Owns:
- Container number
- Carrier code
- Process linkage

Does not derive timeline logic.

---

### Tracking
Event-driven tracking context.

Owns:
- Snapshots (raw carrier payload)
- Observations (normalized events)
- Timeline derivation
- Alert derivation
- Series classification

---

## 2. Canonical States

Container status is derived from events.

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

---

## 2.1 Canonical Event Types

Observations use canonical event types such:

- GATE_IN
- GATE_OUT
- LOAD
- DEPARTURE
- ARRIVAL
- DISCHARGE
- TERMINAL_MOVE
- DELIVERY
- EMPTY_RETURN

`TERMINAL_MOVE` represents operational movement inside terminals (for example positioned in/out).
It must not be reinterpreted ARRIVAL and does not advance lifecycle status on its own.

---

## 3. ACTUAL vs EXPECTED

Each event has:

- event_time_type:
  - ACTUAL
  - EXPECTED

Derived states:

- ACTUAL
- ACTIVE_EXPECTED
- EXPIRED_EXPECTED

Rules:

- ACTUAL overrides EXPECTED
- Multiple EXPECTED form series
- Series classification chooses safe-first primary
- EXPIRED_EXPECTED indicates stale prediction

---

## 4. Event Series

Series grouping:

- Events grouped by semantic key
- Chronologically sorted
- Classified using canonical rules

Series may contain:
- Multiple EXPECTED updates
- ACTUAL confirmation

UI may display:
- Prediction history modal
- Expired expected badge
- Timeline-first shipment view where chronology is primary
- Grouped operational timeline blocks (for example voyage/transshipment segments)
- Supporting shipment metadata and current status in sidebar panels

Tracking ensures:
- Only one primary event per series
- Conflicting ACTUALs are detected

UI must consume these results and must not re-derive series semantics.

---

## 5. Alerts

Alert categories:

- eta
- movement
- customs
- status
- data

Severity:

- info
- warning
- danger
- success

Alerts are derived from observations.

---

## 6. Operational UI Consumption Contract

Shipment/process detail is timeline-first:

- Main column: container selector + timeline
- Sidebar: shipment info + current status + supporting metadata

Timeline rendering should preserve operational grouping and history visibility.
UI may polish presentation, but must not flatten away semantic grouping provided by canonical read models.

---

Domain rule:

> States are derived from events.
> Events are derived from snapshots.
> Snapshots are never discarded.
