# Container Tracker — Domain Model

## 1. Core Entities

### Process (Shipment)
Represents a logical shipment grouping.

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
- Multiple EXPECTED form a series
- Series classification chooses a safe-first primary
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

Tracking ensures:
- Only one primary event per series
- Conflicting ACTUALs are detected

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

Domain rule:

> States are derived from events.  
> Events are derived from snapshots.  
> Snapshots are never discarded.
