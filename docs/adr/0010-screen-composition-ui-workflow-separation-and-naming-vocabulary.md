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
- each architectural boundary must change type explicitly
- UI remains horizontal inside bounded context and should not become accidental domain/application layer

These constraints are already established by project architecture and must be preserved.
`modules/*` are semantic source of truth; capabilities are orchestration-only; UI may manage interaction state and presentation, but must not reinterpret tracking semantics.

---

## Decision

We standardize UI composition around explicit **screen architecture**.

### 1. Canonical vocabulary

To eliminate ambiguity, following terms are now standardized.

#### Page
route-bound entrypoint associated with router params / URL ownership.

Examples:
- `ShipmentPage`
- `DashboardPage`

Rules:
- owns route params
- may connect router/navigation/preload concerns
- should be thin
- should delegate to screen

#### Screen
top-level UI composition root for one business surface.

Examples:
- `ShipmentScreen`
- `DashboardScreen`

Rules:
- composes UI hooks and view sections
- may own screen-level interaction orchestration
- may consume DTO/ViewModel resources
- must not contain transport protocol details inline when those details can be isolated in UI usecases/services
- must not derive domain truth

screen is main unit of UI orchestration.

### Shipment screen canonical composition

Shipment/process detail follows timeline-first structure:

- primary column: container selector + timeline
- supporting sidebar: shipment info + current status + alerts/supporting metadata

Composition rules:

- chronology is primary for operator reading flow
- supporting panels must not interrupt timeline sections
- grouped operational timeline blocks (pre-carriage, voyage/vessel, transshipment, post-carriage/delivery) should be preserved when provided by canonical read models

Reference:

- `docs/UI_PHILOSOPHY.md`

#### View
presentational subtree or visual section of screen.

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
structural component responsible for visual arrangement only.

Examples:
- `ShipmentScreenLayout`
- `PanelLayout`

Rules:
- controls slots, spacing, regions, responsiveness
- should be behavior-light
- should not own async flows or business workflow decisions

#### DialogHost
composition component that mounts one or more dialogs/modals for screen.

Examples:
- `ShipmentDialogsHost`

Rules:
- receives dialog state and handlers
- keeps dialog mounting out of main screen tree
- does not own domain logic

#### Controller Hook
UI hook that owns one workflow or one interaction concern.

Examples:
- `useShipmentRefreshController`
- `useShipmentAlertActionsController`
- `useShipmentDialogsController`

Rules:
- one operational responsibility only
- may own signals/effects/resources related to that concern
- may call UI usecases/services
- must not aggregate unrelated workflows into mega-hook

#### UI Usecase
UI-side orchestration function/service for transport and screen workflow coordination.

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
pure function for formatting, sorting, grouping, mapping, or screen-local utility.

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

route-level page/component must not accumulate all of following in one file:

- multiple screen signals/memos/effects
- network protocol calls
- realtime subscription lifecycle
- retry/watchdog logic
- dialog submit workflows
- alert action workflows
- section rendering contracts

When screen starts owning more than one operational workflow, these workflows must be separated into controller hooks or UI usecases.

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

This aligns with existing principle that routes are thin adapters.### `modules/<bc>/ui/screens/*`
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

This remains **horizontal UI**, which is consistent with ADR-0008: UI must remain outside feature slices and should not be vertically sliced into pseudo-domain structures.

### `modules/<bc>/ui/usecases/*`
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

single layout/view component must not become “god contract”.

When screen has multiple independent concerns, it should compose multiple focused views instead of sending giant flat prop bag into one mega-layout.

Prefer:

- `ShipmentRefreshStatusView`
- `ShipmentAlertsView`
- `ShipmentContainersView`
- `ShipmentDialogsHost`

instead of single layout receiving every signal and handler from entire screen.

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

This remains governed by ADR-0007.

---

## 6. Feature slice ruleThis ADR does **not** introduce UI feature slicReason:
ADR-0008 explicitly keeps `ui/`, `interface/http/`, `infrastructure/`, and `application/ports/` horizontal within BC.
Therefore:

- domain/application semantic concepts may use `features/<feature>/`
- UI should remain under `modules/<bc>/ui/...`
- screen folders are allowed UI organization, not domain feature slices

---

## 7. Complexity trigger thresholds

screen/page file should be considered for mandatory split when it crosses any of these thresholds:

- more than 2 operational workflows
- realtime + retry/watchdog in same file
- dialog workflow + alert workflow + resource orchestration together
- more than 3 `createSignal`
- more than 2 `createMemo`
- more than 1 `createEffect`
- direct fetch/protocol parsing plus large render composition
- layout prop contract that spans unrelated concerns

These are review triggers, not mathematical truths.
intent is to catch orchestration bloat early.

---

## 8. Enforcement direction

This ADR should be enforced in stages.

### Stage 1
Review checklist and PR guidance.

### Stage 2
Custom lint / static checks for obvious violations, for example:

- route files with direct fetch calls
- route/screen files importing realtime clients directly when UI usecase exists
- very large prop contracts
- disallowed imports from UI to domain/infrastructure
- use of tracking derivation functions from UI/capabilities, already aligned with ADR-0007 enforcement guidance.

### Stage 3
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

These tradeoffs are acceptable because repository already favors explicit boundaries and explicit type transitions over implicit freestyle structures.

---

## 10. SummaryWe standardize route UI around:- **Page** = route entrypoint
- **Screen** = top-level business surface composition
- **View** = focused presentational section
- **Layout** = visual arrangement only
- **DialogHost** = modal composition host
- **Controller Hook** = one workflow / one concern
- **UI Usecase** = transport/workflow orchestration for UI
- **UI Helper** = pure deterministic function

goal is to prevent screen files from becoming monolithic orchestrators while preserving:

- BC boundaries
- UI horizontality
- domain truth ownership
- explicit type transitions
- auditability and determinism
