# UI Complexity Hardening Report

## Scope
- Source: `docs/plans/ui-complexity-scope.json`
- Baseline source: `docs/plans/ui-complexity-baseline.json`
- Gate source: `docs/plans/ui-complexity-allowlist.json`

## Current Snapshot (Post-hardening)
- Files scanned: **50**
- Components: **26**
- Pages-like: **4**
- Support: **20**
- Soft violations (`ui:complexity:report`): **0**
- Allowlist entries (`ui:complexity:allowlist:check`): **0**

## Hotspots Refactored (Phase 5)
1. `src/capabilities/search/ui/SearchOverlay.tsx`
2. `src/modules/process/ui/CreateProcessDialog.tsx`

## Reductions Achieved
1. Removed `src/modules/process/ui/screens/DashboardScreen.tsx` from allowlist after component extraction.
2. Removed `src/modules/process/ui/components/ShipmentHeader.tsx` from allowlist after JSX-depth refactor.
3. Removed `src/shared/ui/Dialog.tsx` and `src/shared/ui/LanguageSwitch.tsx` from allowlist after structural flattening.
4. Removed `src/modules/process/ui/ShipmentView.tsx` from allowlist after splitting logic/layout and reducing `max-lines-per-function`.
5. Removed `src/modules/process/ui/components/PredictionHistoryModal.tsx` from allowlist after modal/table extraction.
6. Removed `src/modules/process/ui/components/TimelineNode.tsx` from allowlist after extracting dense layout into support file.
7. Removed `src/capabilities/search/ui/SearchOverlay.tsx` from allowlist after split controller/panel.
8. Removed `src/modules/process/ui/CreateProcessDialog.tsx` from allowlist after extracting async flows + view split.

## Hardening Implemented
1. ESLint hard rules by bucket (`components` vs `pages-like`) for complexity/depth/callbacks.
2. Global UI hard rule for `max-lines-per-function`.
3. Schema/validation policy in lint:
   - visual components cannot import schema/validation libs/modules
   - pages-like must delegate parsing to `ui/validation/**`
4. Dedicated scripts:
   - `ui:complexity:report`
   - `ui:complexity:allowlist:check`
   - `ui:complexity:ci`
5. CI lint job runs `ui:complexity:ci` together with `pnpm run lint`.

## No-regression Policy
- Allowlisted files cannot worsen baseline metrics.
- Non-allowlisted files must meet active thresholds.
- Expired allowlist entries fail CI.

## Phase 7 Closure (2026-02-23)
1. Thresholds foram congelados no estado atual (lint soft/hard e métricas JSX).
2. `allowlist` permanece zerada e o gate de no-regression segue ativo.
3. Recalibração futura só com evidência objetiva e atualização explícita do plano.
