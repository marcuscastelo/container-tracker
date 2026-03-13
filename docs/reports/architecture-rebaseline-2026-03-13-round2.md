# Architecture Rebaseline Report (Round 2)

Date: 2026-03-13  
Objective: rebaseline after enforcement-in-flow + two targeted refactors + one test-suite partition.

Baselines compared:
- Previous snapshot: `docs/reports/code-report/code_report_20260313_031650.txt`
- Current snapshot: `docs/reports/code-report/code_report_20260313_033126.txt`

Generation command:
- `bash scripts/gen-code-report.sh`

---

## 1) Global delta

Previous:
- files analyzed: `664`
- total lines (`.ts + .tsx`): `83428`
- average per file: `125`

Current:
- files analyzed: `671`
- total lines (`.ts + .tsx`): `83404`
- average per file: `124`

Interpretation:
- total size stayed stable (slight reduction)
- ownership clarity improved without horizontal large-scale refactor

---

## 2) Hotspot evolution (this round)

| Hotspot | Previous | Current | Delta | Action | Classification |
|---|---|---|---:|---|---|
| `src/modules/process/ui/validation/processApi.validation.ts` | OK / 47 | OK / 22 | -25 | removed API helper re-exports; kept only UI input mapping | resolvido |
| `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts` | CRITICO / 566 | OK / 120 | -446 | extracted grouping/sorting/message-contract/shared-model helpers | resolvido |
| `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts` | CRITICO / 409 | removed | n/a | replaced by behavior-family suites + helper harness | melhorou |
| `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.* + helper` | n/a | 341 total | n/a | partitioned by behavior family (`operational-summary`, `monthly-chart`, `navbar-summary`) | melhorou |
| `src/capabilities/dashboard/interface/http/dashboard.controllers.ts` | ALERTA / 264 | ALERTA / 264 | 0 | no functional change this round | neutro |
| `src/modules/process/ui/screens/DashboardScreen.tsx` | CRITICO / 661 | CRITICO / 661 | 0 | no extraction in this round | neutro |
| `src/capabilities/search/ui/SearchOverlay.panel.tsx` | CRITICO / 547 | CRITICO / 547 | 0 | no extraction in this round | neutro |
| `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` | CRITICO / 392 | CRITICO / 392 | 0 | no change in this round | neutro |

No hotspot got worse in this round.

---

## 3) Outcome against success criteria

- checklist in PR flow: **yes** (`.github/pull_request_template.md`)
- ADR-0021 influenced concrete refactor: **yes** (`processApi.validation.ts` ownership cleanup)
- dashboard cluster easier to review: **yes** (readmodel split + controller tests partitioned)
- known deviation reduced/reclassified: **yes** (multiple updated to resolved)
- code-report improved in at least two hotspots: **yes** (`processApi.validation.ts`, `dashboard.navbar-alerts.readmodel.ts`, plus test-suite split)

---

## 4) ADR gate decision after round 2

- no new ADR is required now
- continue with refactor + checklist + rebaseline cadence
- next priority remains:
  1. `DashboardScreen.tsx`
  2. `SearchOverlay.panel.tsx`
  3. `dashboard.operational-summary.readmodel.integration.test.ts`
  4. `supabaseTrackingAlertRepository.ts`

