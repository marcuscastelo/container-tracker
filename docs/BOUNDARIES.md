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

---

## 5. Composition Root Rule

Bootstrap ownership is explicit:

- Module infrastructure bootstraps (`modules/*/infrastructure/bootstrap/*`) are composed at application composition roots (for example `src/shared/api/*controllers.bootstrap.ts`).
- Capability interface factories receive module application dependencies via injection.

Forbidden:

- `capabilities/*` importing `modules/*/infrastructure/*` directly
- modules importing capabilities
- domain/application importing HTTP route adapters

---

## 6. Naming Rules

- `*.vm.ts` -> shape/type only
- `*.ui-mapper.ts` -> DTO -> ViewModel mapping only
- `*.service.ts` -> behavior/orchestration in the same layer
- `*.utils.ts` -> small pure helper
- `*.readmodel.ts` -> backend projection owned by the semantic BC

---

## 7. LLM Anti-Patterns

LLMs must NOT:

- add domain logic to UI files
- derive tracking truth in capability/UI layers
- move canonical rules out of owning BC
- hide conflicts/uncertainty for cleaner presentation
- create implicit shared kernel through convenience reuse
