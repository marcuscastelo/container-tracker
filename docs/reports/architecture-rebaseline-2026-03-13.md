# Architecture Rebaseline Report (v3 candidate)

Date: 2026-03-13  
Objective: establish a comparable post-plan baseline and support ADR decisions with evidence.

Baselines compared:
- Previous snapshot: `docs/reports/code-report/code_report_20260313_024007.txt`
- Current snapshot: `docs/reports/code-report/code_report_20260313_031650.txt`
- Cluster inspection reference: `docs/reports/dashboard-navbar-alerts-cluster-inspection-2026-03-13.md`

Generation command:
- `bash scripts/gen-code-report.sh`

---

## 1) Global delta

Previous:
- files analyzed: `656`
- total lines (`.ts + .tsx`): `83217`
- average per file: `126`

Current:
- files analyzed: `664`
- total lines (`.ts + .tsx`): `83428`
- average per file: `125`

Interpretation:
- repository size stayed stable enough to compare hotspot behavior meaningfully
- next decision should focus on concentrated files, not total line growth

---

## 2) Hotspot evolution (priority set)

| Hotspot | Old status/lines | New status/lines | Delta | Category now | Action taken | Result |
|---|---|---|---:|---|---|---|
| `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts` | CRITICO / 566 | CRITICO / 566 | 0 | structural-hotspot | monitored via cluster inspection | observe |
| `src/capabilities/dashboard/interface/http/dashboard.controllers.ts` | ALERTA / 264 | ALERTA / 264 | 0 | refactor-local | monitored via cluster inspection | observe |
| `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts` | CRITICO / 409 | CRITICO / 409 | 0 | guideline-checklist | identified for behavior-family split | next-round |
| `src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts` | CRITICO / 611 | CRITICO / 611 | 0 | guideline-checklist | identified for behavior-family split | next-round |
| `src/shared/api-schemas/dashboard.schemas.ts` | OK / 170 | OK / 170 | 0 | growth-legit | transport-only ownership maintained | acceptable |
| `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` | CRITICO / 529 | CRITICO / 392 | -137 | structural-hotspot | partial decomposition | next-round |
| `src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts` | CRITICO / 533 | OK / 178 | -355 | refactor-local | decomposition completed | resolved |
| `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts` | OK / 58 | OK / 58 | 0 | growth-legit | stable | acceptable |
| `src/modules/process/interface/http/process.controllers.ts` | ALERTA / 369 | OK / 244 | -125 | refactor-local | controller thinning | resolved |
| `src/shared/api/sync.controllers.bootstrap.ts` | ALERTA / 333 | OK / 43 | -290 | refactor-local | bootstrap thinning | resolved |
| `src/modules/process/ui/screens/DashboardScreen.tsx` | CRITICO / 661 | CRITICO / 661 | 0 | structural-hotspot | none in this cycle | next-round |
| `src/capabilities/search/ui/SearchOverlay.panel.tsx` | CRITICO / 547 | CRITICO / 547 | 0 | structural-hotspot | none in this cycle | next-round |

---

## 3) Reclassification summary

Resolved:
- `tracking.persistence.mappers.ts`
- `process.controllers.ts`
- `sync.controllers.bootstrap.ts`

Acceptable:
- `dashboard.schemas.ts`
- `supabaseSyncMetadataRepository.ts`

Observe:
- `dashboard.navbar-alerts.readmodel.ts`
- `dashboard.controllers.ts`

Needs next round:
- dashboard controller/readmodel test concentration
- `supabaseTrackingAlertRepository.ts`
- `DashboardScreen.tsx`
- `SearchOverlay.panel.tsx`

---

## 4) ADR waitlist decision (post-rebaseline)

`Repository / Query / Mapper separation`:
- keep in hold
- reason: substantial progress was achieved by refactor-first; ambiguity not yet proven as cross-module recurring after cleanup

`Controller thinness / HTTP adapter thinness`:
- keep in hold
- reason: dashboard still needs refactor evidence; current pressure may still be local concentration, not missing architecture decision

`Capability read-model composition ADR`:
- keep in hold
- reason: cluster inspection still indicates "observe and reassess", not enough cross-capability evidence

Conclusion:
- no new ADR is mandatory at this point
- proceed with enforcement + focused refactor round

---

## 5) Next sprint execution order

1. Split dashboard tests by behavior family (`controllers` and `operational-summary integration`)
2. Refactor `dashboard.navbar-alerts.readmodel.ts` into helper units
3. Continue decomposition of `supabaseTrackingAlertRepository.ts`
4. Start UI complexity extraction in `DashboardScreen.tsx` or `SearchOverlay.panel.tsx`
5. Regenerate code-report and update this table

