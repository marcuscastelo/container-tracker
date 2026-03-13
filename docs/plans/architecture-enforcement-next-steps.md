# Architecture Enforcement Next Steps (Post-Plan v2)

Date: 2026-03-13
Scope: make ADR-0021 and dashboard/navbar-alerts inspection outcomes operational in daily PR review.

References:
- `docs/adr/0021-validation-layering-and-parsing-modes.md`
- `docs/ui-taxonomy-rollout-guideline.md`
- `docs/reports/dashboard-navbar-alerts-cluster-inspection-2026-03-13.md`
- `docs/reports/code-report/code_report_20260313_031650.txt`

---

## 1) ADR-0021 Adoption Checklist (Validation Layering)

Use this checklist in every PR that touches validation/parsing/decoding.

- Is the parsing mode explicit in code? (`canonical acceptance`, `boundary contract decode`, `tolerant external parsing`, `UI permissive parsing`)
- Is canonical acceptance kept in domain/application invariants only?
- Is HTTP decode strict at boundary (request/response schemas in boundary files)?
- Is UI parsing limited to form/query/storage preparation (without redefining domain truth)?
- Is infra tolerant parsing preserving uncertainty/parse failure visibility?
- Is any `*.validation.ts` file doing network IO, cache orchestration, or adapter wiring?
- Is domain free from transport schema imports and DTO decode helpers?
- Is infra importing only same-layer or explicitly shared helpers (no wrong-layer shortcut)?
- Are parse failures explicit (not silently downgraded)?

Minimum merge gate for affected PRs:
- all checklist items answered
- any exception documented in "Known Deviations" with owner and expiry review

---

## 2) Dashboard Cluster Enforcement Checklist

Use this checklist in PRs touching dashboard/navbar alerts cluster.

- Does read model stay in composition/shaping and avoid hidden semantic re-derivation?
- Is grouping/sorting/prioritization logic isolated in pure helpers where possible?
- Is controller mostly boundary translation (decode -> usecase call -> response map)?
- Is schema still transport-only and compact (no orchestration policy embedded)?
- Are tests split by behavior family instead of monolithic scenario packing?
- Did file growth increase hotspot risk (`CRITICO` / `ALERTA` in code-report)?
- If growth is intentional, is rationale documented in PR under "Why this concentration is acceptable now"?

Behavior-family expectation for tests:
- grouping/sorting behavior
- message contract behavior
- controller boundary behavior
- integration contract behavior

---

## 3) Known Deviations (Current)

These are accepted temporarily and must be revisited with explicit owner tracking.

1. `src/modules/process/ui/validation/processApi.validation.ts`
- Category: refactor local
- Deviation: validation-adjacent file still re-exports API request helpers
- Risk: mode confusion between UI parsing and transport orchestration
- Action: split into `validation/*` and `api/*` ownership with explicit naming

2. `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts`
- Category: structural hotspot
- Deviation: concentration of grouping/sorting/message shaping in one unit
- Risk: maintenance and review friction
- Action: extract pure strategy helpers, keep composition entrypoint thin

3. `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts`
- Category: guideline/checklist
- Deviation: high test density with mixed behavior families
- Risk: slower review and brittle failures
- Action: partition test file by behavior family

4. `src/modules/process/ui/screens/DashboardScreen.tsx`
- Category: structural hotspot
- Deviation: large orchestration/render concentration
- Risk: UI complexity drift
- Action: continue extraction into View/Hook/Usecase/Mapper blocks

5. `src/capabilities/search/ui/SearchOverlay.panel.tsx`
- Category: structural hotspot
- Deviation: large panel with mixed rendering and interaction concerns
- Risk: complexity and ownership blur
- Action: split semantic regions into focused child components

---

## 4) Working Agreement (Lightweight)

- No new ADR proposal without evidence from at least one completed refactor plus rebaseline comparison.
- Prefer checklist + local refactor over new formalization when docs already cover ownership.
- Keep this file updated every sprint architecture review.

