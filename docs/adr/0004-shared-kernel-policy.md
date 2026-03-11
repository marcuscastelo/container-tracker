# ADR-0004 — Shared Kernel Policy

Status: Accepted  
Date: 2026-03-08  
Supersedes: previous ADR-0004 draft

---

# Context

The Container Tracker architecture is a **modular monolith with explicit bounded contexts**.

Current BCs:

- process
- container
- tracking

Each BC owns its domain model, invariants, and internal semantics.

Historically, many monoliths degrade because a `shared/` directory becomes a **shadow domain** where:

- enums
- value objects
- domain helpers
- status models
- business rules

are placed and gradually imported by all modules.

This silently erodes BC boundaries and produces **implicit coupling between domains**.

Because the system is partially developed using LLMs, the risk of accidental shared kernel expansion is significantly higher.  
LLMs tend to centralize abstractions unless explicitly prevented.

Therefore the project must adopt a **strict shared kernel policy**.

---

# Decision

The project adopts a **“duplicate first, share later” policy**.

Code should be duplicated between BCs unless all the following are true:

1. The concept is **semantically identical across BCs**
2. The code contains **no business rule**
3. The abstraction is **stable**
4. The code is **already used in multiple BCs**
5. A formal ADR documents the extraction

Until those conditions are satisfied, duplication is preferred.

---

# Shared Code Categories

Shared code is classified into three categories.

---

# Category 1 — Allowed Shared Infrastructure

The following items are allowed in `shared/` without ADR:

- logging
- tracing
- metrics
- base error classes
- test utilities
- generic functional helpers
- date utilities
- formatting utilities
- serialization helpers
- infrastructure adapters

Examples:

```
shared/logging/logger.ts
shared/errors/base.error.ts
shared/utils/date.ts
shared/test/factories.ts
```

Rules:

- must not contain business semantics
- must not depend on domain models
- must remain infrastructure-level utilities

---

# Category 2 — Watch Zone (Requires Review)

These items may indicate emerging shared semantics and must be reviewed before placement in `shared/`:

- enums
- value objects
- domain-related types
- status-like structures
- event-like structures

These often appear shareable but frequently hide **domain coupling**.

Examples that require review:

```
shared/enums/container-status.ts
shared/types/location.ts
shared/value-objects/port.ts
```

Before placing such elements in `shared/`, the author must ask:

- Is the concept truly identical across BCs?
- Or is this a coincidence of naming?

Example:

```
tracking.status
process.status
```

Even if both contain `"IN_TRANSIT"`, they may represent **different semantics**.

Default decision: **keep duplicated inside each BC**.

---

# Category 3 — Forbidden in Shared

The following must **never exist in `shared/`**:

- Entities
- Aggregates
- Domain services
- Domain repositories
- Domain policies
- Domain invariants
- Domain events
- Timeline derivation
- Status derivation
- Alert derivation
- Event interpretation logic
- Shipment timeline semantic block derivation (voyage/transshipment/pre/post-carriage)

Examples of forbidden shared code:

```
shared/domain/container.entity.ts
shared/domain/status.service.ts
shared/domain/alert-policy.ts
shared/domain/timeline-deriver.ts
```

These must always belong to a **specific bounded context**.

---

# Shared Errors

Shared errors are allowed only if they are **pure structural errors**.

Allowed:

```
InvalidAssociationError
DuplicateKeyError
ValidationError
```

Not allowed:

```
ContainerAlreadyDeliveredError
ShipmentTransshipmentConflictError
ETARegressionDetectedError
```

Errors tied to business semantics must remain inside the owning BC.

---

# Duplication Rule

Duplication between BCs is **not a problem**.

It is preferred when:

- semantics may diverge
- domain ownership must remain clear
- abstraction stability is unknown

Example:

```
tracking/domain/location.ts
process/domain/location.ts
```

Even if implementations look similar, duplication preserves independence.

If the concept later proves stable and identical across BCs, extraction may occur through a new ADR.

---

# Extraction Process

To extract something to `shared/`, all conditions must be met:

1. Used in **at least two BCs**
2. No business logic
3. No domain invariants
4. Stable API
5. Reviewed via ADR

Extraction must include:

- ownership definition
- allowed dependency directions
- usage examples

---

# Directory Structure

Shared code must remain infrastructure-oriented.

```
shared/
  errors/
  logging/
  utils/
  test/
```

The following directories are explicitly forbidden:

```
shared/domain
shared/models
shared/entities
shared/services
```

---

# LLM Guardrails

When generating code, LLMs must follow these rules:

Never move code to `shared/` if it contains:

- domain knowledge
- business semantics
- container lifecycle rules
- tracking timeline logic
- alert logic
- shipment timeline semantic grouping logic

When uncertain:

**duplicate the code instead of sharing it**.

---

# Consequences

Positive:

- preserves bounded context integrity
- prevents hidden coupling
- reduces accidental domain centralization
- improves auditability of domain ownership

Negative:

- some duplication will exist
- small utilities may appear repeated

This is considered an acceptable tradeoff.

---

# Future Evolution

If shared concepts emerge organically across BCs, they may be extracted through a new ADR such as:

```
ADR-0007 — Shared Domain Primitives
```

Until then, duplication remains the default.

---

# Summary

Rule of thumb:

> If a piece of code contains domain meaning, it belongs to a bounded context.

Shared code must remain **infrastructure-level only** unless a formal ADR states otherwise.
