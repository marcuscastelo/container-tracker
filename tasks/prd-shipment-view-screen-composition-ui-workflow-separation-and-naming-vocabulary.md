# PRD — ShipmentView Refactor into Screen Architecture

Status: Proposed  
Date: 2026-03-09  
Scope: `ShipmentView` only  
Out of scope: repository-wide rollout, generic ESLint autofixers, non-shipment screens

---

## 1. Problem

`ShipmentView` has accumulated too many responsibilities in one file:

- process detail resource orchestration
- refresh/sync workflow
- realtime + polling fallback
- create/edit dialog workflow
- alert acknowledge/unacknowledge workflow
- selected container interaction state
- dashboard prefetch intent
- final large prop assembly into a single layout

This makes the screen hard to review, hard to test, and easy to regress.

It also creates risk of UI-layer orchestration leaking into places where boundaries become blurred.  
The project already requires thin routes/adapters, explicit type transitions, and strict UI/domain separation. :contentReference[oaicite:15]{index=15} :contentReference[oaicite:16]{index=16} :contentReference[oaicite:17]{index=17}

---

## 2. Goals

1. Refactor `ShipmentView` into a clearer screen architecture.
2. Isolate each operational workflow into focused hooks/usecases.
3. Reduce prop drilling blast radius.
4. Preserve current behavior exactly.
5. Keep all logic inside `process/ui`, without pushing UI concerns into capabilities/domain.
6. Establish naming and folder conventions that can be reused later.

---

## 3. Non-goals

- No domain logic migration.
- No capability creation.
- No change to tracking semantics.
- No UI redesign.
- No backend API redesign.
- No global refactor outside shipment screen files.

---

## 4. Target architecture

Suggested folder:

```text
src/modules/process/ui/screens/shipment/
  ShipmentPage.tsx
  ShipmentScreen.tsx

  hooks/
    useShipmentScreenResource.ts
    useShipmentRefreshController.ts
    useShipmentDialogsController.ts
    useShipmentAlertActionsController.ts
    useShipmentSelectedContainer.ts

  usecases/
    refreshShipmentTracking.usecase.ts
    submitCreateProcess.usecase.ts
    submitEditProcess.usecase.ts
    acknowledgeShipmentAlert.usecase.ts
    unacknowledgeShipmentAlert.usecase.ts

  components/
    ShipmentScreenLayout.tsx
    ShipmentRefreshStatusView.tsx
    ShipmentAlertsView.tsx
    ShipmentContainersView.tsx
    ShipmentDialogsHost.tsx

  lib/
    shipmentAlerts.sorting.ts
    shipmentRefresh.helpers.ts
    shipmentRefresh.status.ts
    shipmentEdit.mapper.ts
    shipmentError.presenter.ts

  types/
    shipmentScreen.types.ts
```

Notes:

- `ui/` remains horizontal within the process BC, consistent with ADR-0008. :contentReference[oaicite:18]{index=18}
- No `features/shipment-view` slice should be created for this work.

---

## 5. Functional decomposition

### 5.1 `useShipmentScreenResource`
Responsibilities:
- own `createResource(fetchProcess)`
- expose `shipment`, `loading`, `error`, `refetch`, `mutate`
- reset local resource state when process id changes
- expose `reconcileTrackingView()`

Must not:
- own dialog state
- own alert actions
- own selected container state
- own refresh retry workflow

### 5.2 `useShipmentRefreshController`
Responsibilities:
- own refresh-related signals:
  - `isRefreshing`
  - `refreshRetry`
  - `refreshError`
  - `refreshHint`
  - `lastRefreshDoneAt`
- call a UI usecase for refresh workflow
- manage realtime cleanup lifecycle
- expose `triggerRefresh()`

Must not:
- fetch shipment resource directly except through injected callbacks
- own dialog logic
- own alert action logic

### 5.3 `useShipmentDialogsController`
Responsibilities:
- own dialog open/close state
- own initial edit data and focus target
- call create/edit UI usecases
- expose create conflict / create error state

Must not:
- know refresh workflow internals
- know alert action logic

### 5.4 `useShipmentAlertActionsController`
Responsibilities:
- own busy ids
- own alert action transient error
- call ack/unack UI usecases
- reconcile tracking view after action

### 5.5 `useShipmentSelectedContainer`
Responsibilities:
- selected container id
- default selected container
- selected container VM
- selected ETA VM

Must remain presentation-only.

---

## 6. UI usecases

The following UI usecases must be introduced.

### `refreshShipmentTracking.usecase.ts`
Encapsulates:
- enqueue refresh request(s)
- fetch refresh statuses
- realtime terminal wait
- polling watchdog fallback
- timeout / partial failure handling
- result normalization

### `submitCreateProcess.usecase.ts`
Encapsulates:
- `toCreateProcessInput`
- `createProcessRequest`
- conflict parse behavior

### `submitEditProcess.usecase.ts`
Encapsulates:
- `toCreateProcessInput`
- `updateProcessRequest`
- conflict parse behavior

### `acknowledgeShipmentAlert.usecase.ts`
Encapsulates:
- `acknowledgeTrackingAlertRequest`

### `unacknowledgeShipmentAlert.usecase.ts`
Encapsulates:
- `unacknowledgeTrackingAlertRequest`

These remain UI-side orchestration helpers and must not be mistaken for backend application/domain usecases.

---

## 7. View decomposition

Replace one giant prop sink with section-focused views.

Minimum target split:

- `ShipmentScreenLayout`
- `ShipmentRefreshStatusView`
- `ShipmentAlertsView`
- `ShipmentContainersView`
- `ShipmentDialogsHost`

If the existing `ShipmentViewLayout` can be adapted incrementally, that is acceptable.  
The main requirement is to reduce the giant single-contract pattern.

---

## 8. Migration phases

### Phase 1 — Pure extraction
Extract pure helpers from the current file without changing behavior:
- alert sorting
- refresh helper builders
- edit mappers
- refresh status mappers
- readable error helpers

### Phase 2 — Resource hook
Extract `useShipmentScreenResource`.

### Phase 3 — Selection hook
Extract `useShipmentSelectedContainer`.

### Phase 4 — Refresh controller + usecase
Move refresh orchestration out of the screen file.

### Phase 5 — Dialog and alert controllers
Keep current behavior but isolate the workflows.

### Phase 6 — View split
Break the mega layout contract into focused views/components.

---

## 9. Acceptance criteria

### Architecture
- `ShipmentView` no longer contains all workflows inline.
- Refresh workflow is isolated from dialog workflow.
- Alert workflow is isolated from selected container workflow.
- No UI file imports `domain` or `infrastructure`, consistent with current boundary rules. :contentReference[oaicite:19]{index=19}
- No capability is introduced for this refactor.

### Behavior
- Shipment detail fetch behavior remains unchanged.
- Refresh enqueue + realtime + watchdog behavior remains unchanged.
- Create/edit dialog behavior remains unchanged.
- Conflict handling remains unchanged.
- Alert ack/unack behavior remains unchanged.
- Selected container defaulting remains unchanged.
- Dashboard prefetch intent remains unchanged.

### Testability
- Pure helper functions become unit-testable.
- Refresh workflow can be tested independently from render composition.
- Controller hooks are easier to test in isolation.

---

## 10. Suggested test plan

### Unit
- alert sorting helpers
- edit mapper
- refresh status reducers/builders
- refresh error presenter
- recent update hint builder

### Hook / integration
- `useShipmentSelectedContainer`
- `useShipmentDialogsController`
- `useShipmentAlertActionsController`

### Workflow integration
- refresh workflow happy path
- refresh timeout path
- refresh partial failure path
- refresh cancelled/disposed path

### Screen regression
- route id change resets local screen state correctly
- selected container defaults correctly
- dialog open/edit/create still behaves the same

---

## 11. Risks

1. Hidden coupling between current local state variables.
2. Realtime cleanup lifecycle regressions.
3. Refetch/mutate timing regressions.
4. Oversplitting into too many tiny files with unclear ownership.

Mitigation:
- migrate in phases
- keep behavior parity first
- avoid inventing new abstractions not required by the current screen

---

## 12. Definition of done

Done means:

- `ShipmentView` has been replaced by explicit page/screen/controller composition
- helper functions are extracted
- refresh orchestration is no longer inline in the main screen file
- layout prop contract is materially smaller or split into focused section views
- lint, type-check, and relevant tests are green
- no behavior regressions observed in create/edit/refresh/ack flows