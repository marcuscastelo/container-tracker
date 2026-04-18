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

module inside `modules/`:

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
- Preserve status-neutral operational observations (for example `TERMINAL_MOVE`) facts
- Keep carrier-normalizer technical traceability in raw event metadata (for example `normalizer_version`)

Tracking does NOT:
- Generate human labels
- Format dates
- Perform i18n

UI (process/ui) is responsible for:
- Label mapping
- Locale date formatting
- Rendering decisions
- Timeline-first composition in shipment view
- Keeping supporting metadata in sidebar panels
- Preserving operational timeline block grouping exposed by backend read models

---

## 5. Operational UI Philosophy (Canonical)

Shipment/process detail must follow timeline-first layout:

- Main column: container selector + timeline (primary artifact)
- Sidebar: shipment information, current status, supporting metadata

Rules:

- Chronological flow is primary for operator comprehension.
- Supporting cards/panels must not break timeline flow between timeline sections.
- UI should be dense and operational, with clear hierarchy (not cosmetic minimalism).
- Grouped timeline blocks (pre-carriage, vessel/voyage, transshipment, post-carriage/delivery) must be preserved when provided by canonical read models.

Reference:

- `docs/UI_PHILOSOPHY.md`

---

## 6. Read Model Rules

Read models:

- Belong to BC that owns semantics
- Must not import UI
- Must not format presentation strings
- May aggregate cross-entity information

---

## 7. Dependency Rules

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

## 8. Shared Kernel Policy

Shared types must be minimal and stable.

No cross-BC semantic leakage.

If two BCs need same type:
- Prefer duplication over semantic coupling
- Or explicitly define shared kernel in approved `src/shared/*` areas

Operational decision:

- See `docs/adr/0004-shared-kernel-policy.md` for extraction criteria and default duplication policy.

---

Architecture principle:

> domain drives UI.
> UI never defines domain truth.

---

## 9. ViewModel vs UI State vs UI Service

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

## 10. Naming Rules

File names must match responsibility:

- `*.vm.ts` -> ViewModel shape/type only
- `*.ui-mapper.ts` -> HTTP DTO -> ViewModel mapping only
- `*.service.ts` -> UI behavior (sort/filter/group/selection logic)
- `*.utils.ts` -> small pure helpers
- `*.readmodel.ts` -> backend projection/read model

---

## 11. LLM Anti-Patterns

LLMs must NOT:

- put behavior/logic inside ViewModel files
- derive domain truth in UI (status, timeline, alerts)
- convert DTOs into internal application contracts
- simplify timeline/event-series logic
- flatten grouped operational timeline blocks by reinterpreting raw events in UI
- hide ACTUAL conflicts or uncertainty
- move domain rules into capabilities
- create shared kernel implicitly without explicit ownership/policy
