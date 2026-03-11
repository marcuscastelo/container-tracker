# ADR-0007 — Domain Truth Ownership

Status: Accepted  
Date: 2026-03-08  
Related: ADR-0003 (Separate BC from Capabilities), ADR-0004 (Shared Kernel Policy)

---

# Context

Container Tracker is a logistics tracking system where operational decisions depend on **accurate interpretation of historical events**.

The system processes shipping data as a sequence of observations which are transformed into:

```
Snapshot → Observation → Timeline → Status → Alerts
```

Each transformation contains domain rules.

If these rules are implemented in multiple layers (UI, capabilities, routes, utilities), the system risks producing **multiple conflicting interpretations of the same shipment history**.

This is unacceptable because:

- auditability is required
- logistics decisions depend on correct event interpretation
- tracking conflicts must remain visible
- domain rules must be deterministic

Because the project is partially developed with LLM assistance, there is a high risk that logic is unintentionally replicated in UI or orchestration layers.

Therefore the system must explicitly define **where domain truth is owned and derived**.

---

# Decision

Domain truth must be derived **only inside the owning bounded context**.

Other layers may **consume** this truth but must never **re-derive or reinterpret** it.

---

# Canonical Ownership

The following responsibilities belong exclusively to the **tracking bounded context**.

Tracking domain owns:

- observation normalization
- event series grouping
- ACTUAL vs EXPECTED interpretation
- primary event selection (safe-first rule)
- timeline derivation
- event conflict detection
- container lifecycle event classification
- status derivation
- alert derivation

These rules must exist **in exactly one place**.

---

# Domain Truth Pipeline

The canonical pipeline is:

```
Raw Carrier Data
    ↓
Snapshot
    ↓
Observation (normalized)
    ↓
Timeline (series grouped)
    ↓
Status (derived)
    ↓
Alerts (derived)
```

Every stage must be deterministic and append-only where applicable.

Other layers may only consume the results.

---

# Allowed Responsibilities by Layer

## Domain (Bounded Context)

Domain is the **source of truth**.

Domain may:

- interpret events
- derive timeline
- derive status
- derive alerts
- detect conflicts
- classify event types

Domain must not depend on:

- UI
- HTTP
- capabilities
- presentation models

---

## Application Layer

Application may:

- orchestrate domain operations
- compose read models
- aggregate domain outputs
- map domain results to DTOs

Application must not:

- redefine domain rules
- reinterpret event semantics
- override canonical status derivation

---

## Capabilities

Capabilities orchestrate multiple BCs.

Capabilities may:

- combine read models
- join data from different contexts
- shape operational views

Capabilities must not:

- derive status
- interpret tracking events
- classify event series
- override timeline semantics
- introduce new domain invariants

Capabilities are **composition layers**, not domain layers.

---

## Routes / HTTP

Routes are adapters.

Routes may:

- parse requests
- call application use cases
- serialize responses

Routes must not:

- contain domain logic
- derive domain state
- interpret events

---

## UI

UI is responsible for **presentation and interaction only**.

UI may:

- map DTO → ViewModel
- sort data
- filter data
- group data for display
- format dates
- format labels
- manage interaction state
- render conflict indicators
- compose shipment view as timeline-first
- render supporting metadata/status in sidebar panels
- preserve grouped operational timeline blocks exposed by canonical read models

UI must not:

- derive timeline
- classify event series
- derive status
- derive alerts
- reinterpret ACTUAL vs EXPECTED
- detect event conflicts
- flatten semantically grouped timeline blocks by recomputing event meaning

UI may display uncertainty but must not compute it.
Supporting cards must not interrupt chronological timeline flow.

---

# Determinism Requirement

Domain derivations must be deterministic.

Given the same observations:

```
timeline = deterministic
status = deterministic
alerts = deterministic
```

No layer may alter these results.

---

# Conflict Visibility Rule

Conflicts in event history must never be hidden.

Examples:

- multiple ACTUAL events
- contradictory carrier events
- expected events after actual events

Domain must surface these conflicts explicitly.

UI may render them but must never suppress them.

---

# Example Violations

The following patterns violate this ADR.

### UI deriving event semantics

```
PredictionHistoryModal.tsx
→ classifyTrackingSeries(...)
```

Violation: UI interpreting event series.

---

### UI deriving operational markers

```
timelineBlockModel.ts
→ transshipment detection
→ transit gap logic
```

Violation: UI deriving event meaning.

---

### UI flattening grouped operational timeline semantics

```
ShipmentTimeline.tsx
→ takes raw event list
→ rebuilds voyage/transshipment blocks in UI
```

Violation: UI re-deriving tracking semantics that belong to canonical projections.

---

### Capability deriving domain status

```
dashboard.operational-summary.readmodel.ts
→ deriving process status
→ applying ETA selection rule
```

Violation: orchestration layer redefining domain rules.

---

# Enforcement

To enforce this ADR:

Static rules must exist.

Examples:

- UI must not import tracking derivation functions
- capabilities must not import domain classifiers
- only tracking domain may call event classification logic

Custom lint rules should detect:

```
classifyTrackingSeries
deriveTimeline
deriveStatus
deriveAlerts
```

being used outside the tracking domain.

---

# LLM Guardrails

LLMs must follow this rule:

If a feature requires understanding event semantics, it belongs to the **tracking domain**, not the UI or capability layer.

When uncertain:

1. Prefer calling a domain use case
2. Do not reimplement logic

---

# Consequences

Positive:

- single source of truth
- deterministic event interpretation
- strong auditability
- prevention of semantic drift
- safer LLM contributions

Negative:

- UI may require additional backend projections
- some features require backend changes instead of frontend logic

This is considered acceptable.

---

# Summary

The domain defines truth.

All other layers **consume truth but never redefine it**.

Tracking domain owns event interpretation, timeline derivation, status derivation and alert generation.
