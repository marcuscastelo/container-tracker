# ADR-0008 — Feature Slices Inside Bounded Contexts

Status: Accepted  
Date: 2026-03-09  
Decision owner: Repository maintainers

---

# Context

Historically, modules inside `src/modules/<bc>` were organized only by horizontal layers:

```
src/modules/<bc>/
  domain/
  application/
  infrastructure/
  interface/
  ui/
```

As the repository evolved, some bounded contexts (especially `tracking`) accumulated many domain concepts inside the same folders:

```
tracking/domain
tracking/application
tracking/application/projection
tracking/domain/derive
tracking/domain/reconcile
```

This created several problems:

• files related to the same semantic concept were scattered across folders  
• reviewing refactors touching one concept required navigating many directories  
• semantic ownership of logic became harder to identify  
• architectural discussions were harder because the code did not reflect domain concepts clearly

However, a full vertical-slice architecture was **not desired**, because:

• infrastructure and HTTP layers are cross-cutting  
• UI and domain boundaries must remain explicit  
• premature feature slicing can introduce artificial boundaries

Therefore a **conservative middle-ground approach** was adopted.

---

# Decision

Bounded contexts may introduce **feature slices** under:

```
src/modules/<bc>/features/<feature>/
```

Feature slices group **semantically cohesive domain concepts** while preserving the existing architectural layers.

Example:

```
src/modules/tracking/features/timeline/
  domain/
  application/
```

This allows related domain logic, projections, and use cases to live close together while keeping infrastructure and interfaces separate.

---

# Current Adoption

The following feature slices were introduced.

## Tracking

```
tracking/features/
  observation
  series
  timeline
  status
  alerts
```

These represent the canonical pipeline of the tracking domain.

Example:

```
observation → series → timeline → status → alerts
```

## Process

```
process/features/
  operational-projection
  process-sync
```

These represent the main behavioral capabilities of the process BC.

---

# Structure of a Feature Slice

A feature slice **does not replace the layered architecture**.

Inside a feature we still keep:

```
features/<feature>/
  domain/
  application/
```

Example:

```
features/timeline/
  domain/
    derive/
    model/
  application/
    projection/
```

Typical responsibilities:

| Layer       | Responsibility                        |
| ----------- | ------------------------------------- |
| domain      | core semantic logic                   |
| application | orchestration, projections, use cases |

Infrastructure and HTTP remain outside feature slices.

---

# What Must NOT Move Into Feature Slices

The following remain **horizontal within the BC**:

```
infrastructure/
interface/http/
ui/
application/ports/
```

These are cross-cutting or boundary concerns.

Example:

```
tracking/infrastructure/carriers
tracking/interface/http
process/ui
```

Keeping these outside slices prevents duplication and keeps BC boundaries clear.

---

# When to Create a Feature Slice

A new feature slice may be created when **all conditions are met**:

1. The concept represents a **clear semantic unit of the domain**.
2. It contains **multiple related files across layers**.
3. The concept has **stable meaning in the domain language**.
4. The slice improves **discoverability or refactor safety**.

Examples that qualify:

• timeline derivation  
• alert lifecycle  
• operational projections

---

# When NOT to Create a Feature Slice

Do **not** create slices for:

### Thin concepts

Example:

```
refresh
snapshot-history
container-association
```

These are either:

• small orchestration helpers  
• infrastructure triggers  
• supporting utilities

### Cross-cutting infrastructure

Example:

```
carriers
persistence
http controllers
ui components
```

These remain horizontal.

---

# Naming Guidelines

Feature slice names should reflect **domain language**, not mechanisms.

Prefer:

```
timeline
alerts
observation
series
```

Avoid names like:

```
reconciliation
pipeline
manager
helpers
```

The slice name should answer:

> “What domain concept does this represent?”

---

# Dependency Rules

Feature slices do **not** introduce new dependency rules between features.

All existing DDD rules still apply:

### Domain

Domain must not depend on:

```
application
interface
ui
routes
```

### Application

Application must not depend on:

```
ui
http DTO schemas
```

### UI

UI must not import:

```
domain
infrastructure
```

These rules are enforced by ESLint.

---

# Cross-Feature Interaction

Feature slices inside the same BC may interact through:

```
domain models
read models
application projections
```

However they should **not introduce circular dependencies**.

Example (tracking pipeline):

```
observation → series → timeline → status → alerts
```

The flow should remain directional.

---

# Migration Strategy

Feature slices should be introduced **incrementally**.

Safe approach:

1. Identify cohesive semantic cluster.
2. Move files into `features/<name>`.
3. Update imports.
4. Run:

```
pnpm lint
pnpm type-check
pnpm test
```

5. Validate no behavior changes.

Large structural refactors should be executed in **phases**.

---

# Consequences

## Positive

• clearer semantic structure  
• easier refactoring of domain logic  
• smaller conceptual scope per folder  
• improved architectural discoverability  

## Tradeoffs

• slightly deeper folder hierarchy  
• some concepts remain horizontal intentionally  

This is acceptable in order to maintain conservative architecture boundaries.

---

# Future Considerations

Feature slices should remain **limited and intentional**.

Not every concept should become a slice.

Future candidates should be evaluated case-by-case using the criteria in this ADR.

The goal is **clarity**, not maximal slicing.

---

# Summary

The repository now supports **feature slices inside bounded contexts**:

```
modules/<bc>/features/<feature>
```

This structure:

• groups cohesive domain logic  
• preserves layered architecture  
• avoids premature vertical slicing  

The approach is intentionally **conservative** and should remain so as the system evolves.