# Container Tracker — Architecture

## 1. High-Level Structure

```
src/
  modules/          # Bounded Contexts (semantic source of truth)
    process/
    container/
    tracking/

  capabilities/     # Cross-cutting feature slices (composition/orchestration)
    search/

  routes/           # Framework routing layer
  shared/           # Pure utilities, shared UI, infra helpers
```

---

## 2. Bounded Contexts (modules/*)

A module inside `modules/`:

- Owns its semantic model
- Defines entities, value objects and invariants
- Implements domain rules
- May expose:
  - Use cases
  - Canonical read models
- Must NOT:
  - Format dates for locale
  - Define final UI labels
  - Depend on capabilities
  - Depend on UI components

Domain → Application → Infrastructure → Interface

Dependencies must flow inward only.

---

## 3. Capabilities (capabilities/*)

Capabilities:

- Do not own domain semantics
- Orchestrate multiple Bounded Contexts
- Compose read models
- Provide feature-level behavior (e.g. global search)

Capabilities may depend on:
- modules/* (application layer only)

Modules must never depend on capabilities.

---

## 4. Timeline Architecture (Updated)

### Before
Tracking timeline mixed:
- Semantic derivation
- UI label generation
- Date formatting

### Now

Tracking exposes:

```
tracking.timeline.readmodel.ts
```

Exports:

- TrackingTimelineItem
- deriveTimelineWithSeriesReadModel()

Tracking responsibilities:
- Series grouping
- Safe-first primary selection
- Derived state (ACTUAL / EXPECTED / EXPIRED_EXPECTED)
- Chronological ordering

Tracking does NOT:
- Generate human labels
- Format dates
- Perform i18n

UI (process/ui) is responsible for:
- Label mapping
- Locale date formatting
- Rendering decisions

---

## 5. Read Model Rules

Read models:

- Belong to the BC that owns the semantics
- Must not import UI
- Must not format presentation strings
- May aggregate cross-entity information

---

## 6. Dependency Rules

Allowed:

- capabilities → modules/application
- modules/application → modules/domain
- modules/infrastructure → modules/domain

Forbidden:

- modules → capabilities
- modules/domain → shared/ui
- modules/domain → interface/http
- cross-BC domain imports (unless explicit shared kernel)

---

## 7. Shared Kernel Policy

Shared types must be minimal and stable.

No cross-BC semantic leakage.

If two BCs need the same type:
- Prefer duplication over semantic coupling
- Or explicitly define a shared kernel in `shared/domain/`

Operational decision:

- See `docs/adr/0004-shared-kernel-policy.md` for extraction criteria and default duplication policy.

---

Architecture principle:

> The domain drives the UI.  
> The UI never defines domain truth.

---

## 8. ViewModel vs UI State vs UI Service

Use strict separation in UI files:

- **ViewModel (`*.vm.ts`)**: renderable data shape only. No behavior.
- **UI State**: interaction state (sort, filter, selection, expanded rows, pagination).
- **UI Service / Utility (`*.service.ts` / `*.utils.ts`)**: pure behavior over ViewModels (sorting, grouping, filtering, comparison).
- **UI Mapper (`*.ui-mapper.ts`)**: transforms HTTP Response DTO -> ViewModel.

Rules:

- ViewModel files must not contain domain derivation.
- UI services must not import domain derivation logic.
- DTO-to-VM mapping stays in mapper files only.

---

## 9. Naming Rules

File names must match responsibility:

- `*.vm.ts` -> ViewModel shape/type only
- `*.ui-mapper.ts` -> HTTP DTO -> ViewModel mapping only
- `*.service.ts` -> UI behavior (sort/filter/group/selection logic)
- `*.utils.ts` -> small pure helpers
- `*.readmodel.ts` -> backend projection/read model

---

## 10. LLM Anti-Patterns

LLMs must NOT:

- put behavior/logic inside ViewModel files
- derive domain truth in UI (status, timeline, alerts)
- convert DTOs into internal application contracts
- simplify timeline/event-series logic
- hide ACTUAL conflicts or uncertainty
- move domain rules into capabilities
- create shared kernel implicitly without explicit ownership/policy
