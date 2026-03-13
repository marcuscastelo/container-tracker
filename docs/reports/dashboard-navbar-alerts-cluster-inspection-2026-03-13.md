# Dashboard + Navbar Alerts Cluster Inspection (2026-03-13)

## Scope

Inspected files:

- `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts`
- `src/capabilities/dashboard/application/tests/dashboard.navbar-alerts.readmodel.test.ts`
- `src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts`
- `src/capabilities/dashboard/interface/http/dashboard.controllers.ts`
- `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts`
- `src/shared/api-schemas/dashboard.schemas.ts`
- `src/shared/ui/navbar-alerts/*`

---

## Observations

1. Shared UI extraction is a clear improvement:
- navbar alerts UI moved into focused units under `src/shared/ui/navbar-alerts/*`.
- `AppHeader.tsx` became smaller and easier to review.

2. Capability composition pressure increased:
- `dashboard.navbar-alerts.readmodel.ts` centralizes grouping/sorting/message-contract shaping and container summary enrichment.
- this is largely legitimate capability composition, but concentration is high.

3. Controller thinness risk is emerging:
- `dashboard.controllers.ts` owns multiple mapping branches and endpoint response shaping.
- boundary adapters remain functional, but mapping density is growing.

4. Test density is high:
- integration/controller suites are large and mix multiple behavior families.
- this reduces review speed and increases maintenance cost.

5. Shared API schema growth is expected:
- `dashboard.schemas.ts` expanded with navbar alerts contracts.
- this is acceptable as long as contract ownership remains transport-only.

---

## Classification

- Growth legitimacy: **yes** (feature scope expansion + shared UI extraction).
- Refactor recommendation: **yes** (readmodel/controller/test partitioning).
- Structural hotspot status: **observe and reassess** (not ADR-worthy yet).

Current conclusion:
- no new ADR required now for capability composition or controller thinness.
- proceed with refactor-first plus checklist enforcement.

---

## Refactor-First Suggestions

1. Split `dashboard.navbar-alerts.readmodel.ts` into focused units:
- message contract parsing
- grouping/sorting strategies
- accumulator assembly

2. Extract response mappers from `dashboard.controllers.ts` into dedicated mapper units.

3. Partition large dashboard tests by behavior family:
- grouping/sorting behavior
- message contract handling
- controller boundary behavior
- integration coverage

4. Reassess ADR need only after 1-2 real refactors, not from static size metrics alone.
