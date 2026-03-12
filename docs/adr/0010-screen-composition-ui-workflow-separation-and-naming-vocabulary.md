# ADR-0010 — Screen Composition, UI Workflow Separation, and Naming Vocabulary

Status: Proposed  
Date: 2026-03-09  
Owner: Repository maintainers  
Related:
- ADR-0003 — Separate BC from Capabilities
- ADR-0007 — Domain Truth Ownership
- ADR-0008 — Feature Slices Inside Bounded Contexts
- TYPE_ARCHITECTURE.md
- ARCHITECTURE.md

---

## Context

Some UI route-level components have grown into large orchestration units that mix:

- screen resource fetching
- async workflow coordination
- realtime subscriptions
- retry/watchdog logic
- dialog state and submit handlers
- interaction state
- large layout prop contracts

This creates several problems:

- low readability
- hard reviewability
- unstable prop contracts
- poor refactor safety
- duplication of orchestration patterns
- increased risk of boundary leakage from UI into semantics or infrastructure

This is especially risky in this repository because:

- `modules/*` own canonical semantics and must not depend on capabilities
- UI must consume truth, not derive domain truth
- each architectural boundary must change the type explicitly
- UI remains horizontal inside the bounded context and should not become an accidental domain/application layer

These constraints are already established by the project architecture and must be preserved.  
`modules/*` are the semantic source of truth; capabilities are orchestration-only; UI may manage interaction state and presentation, but must not reinterpret tracking semantics. :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6}

---

## Decision

We standardize UI composition around explicit **screen architecture**.

### 1. Canonical vocabulary

To eliminate ambiguity, the following terms are now standardized.

#### Page
A route-bound entrypoint associated with router params / URL ownership.

Examples:
- `ShipmentPage`
- `DashboardPage`

Rules:
- owns route params
- may connect router/navigation/preload concerns
- should be thin
- should delegate to a screen

#### Screen
The top-level UI composition root for one business surface.

Examples:
- `ShipmentScreen`
- `DashboardScreen`

Rules:
- composes UI hooks and view sections
- may own screen-level interaction orchestration
- may consume DTO/ViewModel resources
- must not contain transport protocol details inline when those details can be isolated in UI usecases/services
- must not derive domain truth

A screen is the main unit of UI orchestration.

### Shipment screen canonical composition

Shipment/process detail follows a timeline-first structure:

- primary column: container selector + timeline
- supporting sidebar: shipment info + current status + alerts/supporting metadata

Composition rules:

- chronology is primary for operator reading flow
- supporting panels must not interrupt timeline sections
- grouped operational timeline blocks (pre-carriage, voyage/vessel, transshipment, post-carriage/delivery) should be preserved when provided by canonical read models

Reference:

- `docs/UI_PHILOSOPHY.md`

#### View
A presentational subtree or visual section of a screen.

Examples:
- `ShipmentAlertsView`
- `ShipmentContainersView`
- `ShipmentHeaderView`

Rules:
- receives focused props
- renders data
- may perform local presentation-only derivation
- must not own cross-section orchestration

Use `View` for render-focused components, not for route entrypoints.

#### Layout
A structural component responsible for visual arrangement only.

Examples:
- `ShipmentScreenLayout`
- `PanelLayout`

Rules:
- controls slots, spacing, regions, responsiveness
- should be behavior-light
- should not own async flows or business workflow decisions

#### DialogHost
A composition component that mounts one or more dialogs/modals for a screen.

Examples:
- `ShipmentDialogsHost`

Rules:
- receives dialog state and handlers
- keeps dialog mounting out of the main screen tree
- does not own domain logic

#### Controller Hook
A UI hook that owns one workflow or one interaction concern.

Examples:
- `useShipmentRefreshController`
- `useShipmentAlertActionsController`
- `useShipmentDialogsController`

Rules:
- one operational responsibility only
- may own signals/effects/resources related to that concern
- may call UI usecases/services
- must not aggregate unrelated workflows into a mega-hook

#### UI Usecase
A UI-side orchestration function/service for transport and screen workflow coordination.

Examples:
- `refreshShipmentTrackingUsecase`
- `submitCreateProcessUsecase`

Rules:
- belongs to `modules/<bc>/ui/usecases/**`
- may call API clients / request validators / response parsers
- may consolidate protocol details
- does not define domain truth
- does not replace backend application usecases

#### UI Helper / Lib Function
A pure function for formatting, sorting, grouping, mapping, or screen-local utility.

Examples:
- `toSortedActiveAlerts`
- `toReadableErrorMessage`

Rules:
- no signals/effects/resources
- no hidden IO
- deterministic
- extracted when reusable or when it reduces screen noise

---

## 2. Separation rule for route UI

A route-level page/component must not accumulate all of the following in one file:

- multiple screen signals/memos/effects
- network protocol calls
- realtime subscription lifecycle
- retry/watchdog logic
- dialog submit workflows
- alert action workflows
- section rendering contracts

When a screen starts owning more than one operational workflow, these workflows must be separated into controller hooks or UI usecases.

---

## 3. Where code should live

### `routes/*`
Thin route adapters only.

Allowed:
- params extraction
- route-level composition
- handoff to page/screen

Not allowed:
- protocol orchestration
- inline domain reinterpretation
- complex screen state machines

This aligns with the existing principle that routes are thin adapters. :contentReference[oaicite:7]{index=7}

### `modules/<bc>/ui/screens/*`
Home of screen/page/view/layout/dialog composition.

Suggested structure:

```text
modules/process/ui/screens/shipment/
  ShipmentPage.tsx
  ShipmentScreen.tsx

  hooks/
  usecases/
  components/
  lib/
  types/
```

This remains **horizontal UI**, which is consistent with ADR-0008: UI must remain outside feature slices and should not be vertically sliced into pseudo-domain structures. :contentReference[oaicite:8]{index=8}

### `modules/<bc>/ui/usecases/*`
Transport/workflow orchestration for UI.

Examples:
- submit create/edit
- refresh tracking workflow
- acknowledge/unacknowledge workflow

### `modules/<bc>/ui/lib/*`
Pure functions:
- sorters
- mappers
- presentation helpers
- state-free reducers/builders

---

## 4. Prop contract rule

A single layout/view component must not become a “god contract”.

When a screen has multiple independent concerns, it should compose multiple focused views instead of sending a giant flat prop bag into one mega-layout.

Prefer:

- `ShipmentRefreshStatusView`
- `ShipmentAlertsView`
- `ShipmentContainersView`
- `ShipmentDialogsHost`

instead of a single layout receiving every signal and handler from the entire screen.

Prop drilling is acceptable when focused and local.  
What is forbidden is **high-churn mega-contracts** that couple unrelated sections.

---

## 5. UI responsibility boundary

UI may:

- map DTO → ViewModel
- sort/filter/group for display
- manage interaction state
- handle selection state
- format labels and dates
- coordinate UI refresh flows
- preserve timeline-first flow and grouped operational blocks from canonical read models

UI must not:

- derive tracking semantics
- reclassify events
- derive canonical status
- derive canonical alerts
- reinterpret ACTUAL vs EXPECTED
- hide domain conflicts
- flatten grouped operational timeline semantics by recomputing them in UI

This remains governed by ADR-0007. :contentReference[oaicite:9]{index=9} :contentReference[oaicite:10]{index=10}

---

## 6. Feature slice rule

This ADR does **not** introduce UI feature slices as a new architectural pattern.

Reason:
ADR-0008 explicitly keeps `ui/`, `interface/http/`, `infrastructure/`, and `application/ports/` horizontal within the BC. :contentReference[oaicite:11]{index=11}

Therefore:

- domain/application semantic concepts may use `features/<feature>/`
- UI should remain under `modules/<bc>/ui/...`
- screen folders are allowed as UI organization, not as domain feature slices

---

## 7. Complexity trigger thresholds

A screen/page file should be considered for mandatory split when it crosses any of these thresholds:

- more than 2 operational workflows
- realtime + retry/watchdog in the same file
- dialog workflow + alert workflow + resource orchestration together
- more than 3 `createSignal`
- more than 2 `createMemo`
- more than 1 `createEffect`
- direct fetch/protocol parsing plus large render composition
- a layout prop contract that spans unrelated concerns

These are review triggers, not mathematical truths.  
The intent is to catch orchestration bloat early.

---

## 8. Enforcement direction

This ADR should be enforced in stages.

### Stage 1
Review checklist and PR guidance.

### Stage 2
Custom lint / static checks for obvious violations, for example:

- route files with direct fetch calls
- route/screen files importing realtime clients directly when a UI usecase exists
- very large prop contracts
- disallowed imports from UI to domain/infrastructure
- use of tracking derivation functions from UI/capabilities, already aligned with ADR-0007 enforcement guidance. :contentReference[oaicite:12]{index=12}

### Stage 3
Repository-wide rollout by screen family.

---

## 9. Consequences

### Positive
- clearer UI composition
- smaller review units
- better refactor safety
- reduced prop contract churn
- less accidental boundary leakage
- easier LLM contribution quality

### Tradeoffs
- more files
- more explicit orchestration layers in UI
- some boilerplate for screen hooks/usecases

These tradeoffs are acceptable because the repository already favors explicit boundaries and explicit type transitions over implicit freestyle structures. :contentReference[oaicite:13]{index=13} :contentReference[oaicite:14]{index=14}

---

## 10. Summary

We standardize route UI around:

- **Page** = route entrypoint
- **Screen** = top-level business surface composition
- **View** = focused presentational section
- **Layout** = visual arrangement only
- **DialogHost** = modal composition host
- **Controller Hook** = one workflow / one concern
- **UI Usecase** = transport/workflow orchestration for UI
- **UI Helper** = pure deterministic function

The goal is to prevent screen files from becoming monolithic orchestrators while preserving:

- BC boundaries
- UI horizontality
- domain truth ownership
- explicit type transitions
- auditability and determinism
