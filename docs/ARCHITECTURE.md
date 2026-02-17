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

---

Architecture principle:

> The domain drives the UI.  
> The UI never defines domain truth.
