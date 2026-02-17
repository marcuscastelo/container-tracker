# Process Module (Bounded Context)

Represents shipment aggregation logic.

## Responsibilities

- Process entity management
- Container association
- Operational summary derivation
- Process-level read models

---

## UI Responsibilities

UI is responsible for:

- Rendering timeline
- Formatting dates
- Mapping event types to labels

Process provides only semantic data.

---

## Dependencies

Process may depend on:

- Tracking application read models (not tracking domain)

Process must NOT:

- Import tracking domain types directly
- Define presentation strings
