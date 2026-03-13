# Architecture Hotspots Live Table

Date: 2026-03-13  
Source baseline: `docs/reports/code-report/code_report_20260313_031650.txt`

Status legend:
- `resolved`: reduced and below concern threshold for this cycle
- `acceptable`: growth is legitimate, no immediate split required
- `observe`: still large but stable, watch in next baseline
- `next-round`: active refactor target for next sprint

Category legend:
- `growth-legit`
- `structural-hotspot`
- `refactor-local`
- `guideline-checklist`
- `adr-future-hold`

---

| Hotspot | Owner | Category | Action | Status | Priority | Next review |
|---|---|---|---|---|---|---|
| `src/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel.ts` | Capability dashboard maintainers | structural-hotspot | Split message-contract parse, grouping/sorting, and accumulator shaping into pure helpers | next-round | P0 | Sprint arquitetural seguinte |
| `src/capabilities/dashboard/interface/http/dashboard.controllers.ts` | Capability dashboard + HTTP boundary maintainers | refactor-local | Extract response mappers and keep adapter flow decode->usecase->schema | observe | P1 | Sprint arquitetural seguinte |
| `src/capabilities/dashboard/interface/http/tests/dashboard.controllers.test.ts` | Capability dashboard maintainers | guideline-checklist | Partition tests by behavior family | next-round | P0 | Sprint arquitetural seguinte |
| `src/capabilities/dashboard/application/tests/dashboard.operational-summary.readmodel.integration.test.ts` | Capability dashboard maintainers | guideline-checklist | Split integration assertions by family and helper builders | next-round | P0 | Sprint arquitetural seguinte |
| `src/shared/api-schemas/dashboard.schemas.ts` | Shared API schema maintainers | growth-legit | Keep transport-only ownership; avoid orchestration policy | acceptable | P2 | Next baseline |
| `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` | Tracking infra maintainers | structural-hotspot | Continue query/mapping decomposition and remove mixed concerns | next-round | P0 | Sprint arquitetural seguinte |
| `src/modules/tracking/infrastructure/persistence/tracking.persistence.mappers.ts` | Tracking infra maintainers | refactor-local | Keep decomposition direction; enforce mapper-only responsibilities | observe | P1 | Next baseline |
| `src/modules/tracking/infrastructure/persistence/supabaseSyncMetadataRepository.ts` | Tracking infra maintainers | growth-legit | Preserve boundary-safe normalization only | acceptable | P2 | Next baseline |
| `src/modules/process/interface/http/process.controllers.ts` | Process HTTP maintainers | refactor-local | Preserve thin controller path and mapper extraction | observe | P1 | Next baseline |
| `src/shared/api/sync.controllers.bootstrap.ts` | Shared API bootstrap maintainers | refactor-local | Keep thin wiring-only bootstrap; avoid policy/query creep | resolved | P1 | Next baseline |
| `src/modules/process/ui/screens/DashboardScreen.tsx` | Process UI maintainers | structural-hotspot | Continue extraction to View/Hook/Usecase/Mapper units | next-round | P0 | Sprint arquitetural seguinte |
| `src/capabilities/search/ui/SearchOverlay.panel.tsx` | Search capability UI maintainers | structural-hotspot | Extract semantic blocks and interaction handlers | next-round | P0 | Sprint arquitetural seguinte |
| `src/modules/process/ui/validation/processApi.validation.ts` | Process UI maintainers | refactor-local | Separate UI validation from transport helper exports | next-round | P0 | Sprint arquitetural seguinte |
| `src/modules/process/ui/screens/shipment/lib/shipmentRefresh.status.ts` | Process UI maintainers | guideline-checklist | Keep schema ownership explicit in boundary schema files | observe | P2 | Next baseline |

---

## Update Protocol

On each architecture sprint:
- update this table status using latest code-report
- move `next-round` items to `observe` or `resolved` with evidence
- if same ambiguity repeats across multiple modules, mark as `adr-future-hold`

