# Architectural Boundaries — BC vs Capability

This document formalizes architectural dependency rules.

---

## 1. Bounded Context (modules/*)

A Bounded Context:

- Owns domain semantics
- Defines entities, VOs, invariants
- Exposes use cases and read models
- Does NOT depend on capabilities

Allowed dependencies:

- domain ← application ← infrastructure ← interface

Forbidden:

- domain → UI
- domain → HTTP
- modules → capabilities
- cross-BC domain imports (unless shared kernel)

---

## 2. Capability (capabilities/*)

A Capability:

- Orchestrates multiple BCs
- Composes read models
- Provides feature-level behavior
- Does NOT define canonical domain rules

Capabilities may depend on:

- modules/application layer

Capabilities must NOT:

- Import modules/domain directly
- Introduce new domain invariants

---

## 3. Shared Kernel

If two BCs require shared types:

- Prefer duplication over coupling
- Or define minimal shared kernel in shared/domain

Policy reference:

- `docs/adr/0004-shared-kernel-policy.md` (operational rule: duplicate by default, extract only with explicit criteria)

Shared kernel must:

- Contain stable abstractions only
- Avoid business rules

---

## 4. UI Responsibility Boundary

UI layer:

- Maps semantic types → labels
- Formats dates
- Applies i18n
- Handles interaction state

UI must not:

- Reimplement domain derivation
- Override safe-first rules
