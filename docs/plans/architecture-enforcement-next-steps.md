# Architecture Enforcement Next Steps (Post-Plan v2)

Date: 2026-03-13
Scope: make ADR-0021 and dashboard/navbar-alerts inspection outcomes operational in daily PR review.

References:
- `docs/adr/0021-validation-layering-and-parsing-modes.md`
- `docs/ui-taxonomy-rollout-guideline.md`
- `docs/reports/dashboard-navbar-alerts-cluster-inspection-2026-03-13.md`
- `docs/reports/code-report/code_report_20260313_033126.txt`
- `docs/reports/architecture-rebaseline-2026-03-13-round2.md`
- `.github/pull_request_template.md`

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

This list is mandatory to update when a deviation is created, resolved, reassigned, or reaches review deadline.

### Active

| Deviation | Category | Owner | Risk | Action | Status | Next review |
|---|---|---|---|---|---|---|
| `src/modules/process/ui/screens/DashboardScreen.tsx` | structural-hotspot | Process UI maintainers | UI complexity drift | Continue extraction into View/Hook/Usecase/Mapper blocks | active | Next architecture sprint |
| `src/capabilities/search/ui/SearchOverlay.panel.tsx` | structural-hotspot | Search capability UI maintainers | complexity and ownership blur | Split semantic regions into focused child components | active | Next architecture sprint |
| `src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts` | guideline-checklist | Dashboard capability maintainers | mixed behavior families in one suite | partition by behavior family with extracted helpers | active | Next architecture sprint |
| `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` | structural-hotspot | Tracking infra maintainers | query/mapping concentration | continue decomposition while preserving boundary rules | active | Next architecture sprint |

### Resolved in this round (2026-03-13)

| Deviation | Resolution | Evidence |
|---|---|---|
| `src/modules/process/ui/validation/processApi.validation.ts` re-exported API helpers | split ownership: validation file now only maps UI form -> request input; request helpers consumed from `ui/api/process.api.ts` | `code-report`: 47 -> 22 lines |
| `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts` monolithic shaping/grouping/sorting | extracted pure helpers (`*.grouping.ts`, `*.sorting.ts`, `*.message-contract.ts`, `*.readmodel.shared.ts`), keeping read model as composition entrypoint | `code-report`: 566 -> 120 lines |
| `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts` monolithic mixed suite | replaced by behavior-family test files + shared harness helper | monolith removed (409 lines) and split suite introduced |

---

## 4) Working Agreement (Lightweight)

- No new ADR proposal without evidence from at least one completed refactor plus rebaseline comparison.
- Prefer checklist + local refactor over new formalization when docs already cover ownership.
- Keep this file updated every sprint architecture review.
