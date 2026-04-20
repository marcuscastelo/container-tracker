# UI Taxonomy Rollout Guideline (ADR-0010 Operationalization)

This guideline applies existing decisions from ADR-0010 and `docs/ARCHITECTURE.md` without creating new ADR.

References:
- `docs/adr/0010-screen-composition-ui-workflow-separation-and-naming-vocabulary.md`
- `docs/ARCHITECTURE.md`
- `docs/TYPE_ARCHITECTURE.md`
- `docs/BOUNDARIES.md`

---

## 1) Responsibility Vocabulary

Use one of these roles for each new UI file:

- Screen
- View
- Layout
- Hook (controller concern)
- UI Usecase
- Mapper
- ViewModel
- Validation
- Telemetry
- Utility

If no role fits, treat it review signal and split responsibilities.

---

## 2) Folder Baseline

Use `screens/` when:
- route/screen-level composition is primary concern

Use `components/` when:
- unit is presentational or local interaction UI

Use `lib/` when:
- helper is pure and screen-local

Use `mappers/` when:
- transforming DTO/read-model into VM or UI-oriented display shape

Use `viewmodels/` when:
- defining VM shape/contracts only

Use `validation/` when:
- handling form/query/storage parse and normalization

Use `telemetry/` when:
- emitting analytics/operational telemetry events

Use `hooks/` when:
- isolating one workflow/interaction concern from screen composition

Use `usecases/` when:
- orchestrating transport/UI workflow outside screen render trees

---

## 3) PR Checklist (UI Taxonomy)

For each changed UI file, verify:

- File role is explicit (Screen/View/Layout/Hook/Usecase/Mapper/VM/Validation/Telemetry/Utility).
- File name and folder match selected responsibility.
- No ad-hoc `presenter` naming outside agreed vocabulary.
- `mapper` files live in `mappers/` unless strong local-only reason is documented.
- Page/Screen files are not absorbing excessive interaction orchestration.
- `*.vm.ts` files keep shape/contracts only (no behavior).
- `validation/*` files do not become API/orchestration hubs.
- UI does not derive canonical domain truth (status/timeline/alerts).
- If component became hub, extraction follows proven pattern used in `src/shared/ui/navbar-alerts/*`.

---

## 4) Extraction Heuristic for Component Hubs

When UI file starts concentrating multiple concerns:

1. Extract focused child components for semantic UI blocks.
2. Move workflow orchestration to controller hooks or UI usecases.
3. Keep mapping logic in `mappers/`.
4. Keep query/storage parsing in `validation/`.
5. Keep render tree shallow and reviewable.

Positive repository example:
- `src/shared/ui/AppHeader.tsx` + `src/shared/ui/navbar-alerts/*`

---

## 5) Small Semantic Alignment Backlog

Candidate low-risk alignment tasks:

- `src/modules/process/ui/screens/shipment/lib/shipmentEdit.mapper.ts`
  - evaluate move to `mappers/` if responsibility is cross-screen mapping.
- presenter-named files split between `components/` and `lib/`
  - align naming to View/Utility vocabulary.
- service files under `viewmodels/`
  - rename/move to `*.service.ts` location matching behavior ownership.
- alignment review in:
  - `src/modules/agent/ui/*`
  - `src/capabilities/search/ui/*`

These are rollout/refactor tasks, not new architecture decisions.
