# Plano de Hardenização de Complexidade UI (v3, execução)

## Objetivo
Endurecer práticas para evitar componentes gigantes, wrapper-chain sem semântica e mistura de responsabilidades, sem induzir componentização artificial.

## Estado Atual
- Rollout definido em 7 fases (baixo risco -> alto risco).
- Baseline canônica gerada e atualizada por script (`ui:complexity:report:write`).
- Gate técnico ativo com:
  - regras ESLint por path (components vs pages-like)
  - gate de métricas JSX via script + allowlist determinística
- Allowlist reduzida para **0 entradas**.

## Artefatos
- Plano vivo: `docs/plans/complexity-hardening-plan.md`
- Baseline humana: `docs/plans/ui-complexity-baseline.md`
- Baseline máquina: `docs/plans/ui-complexity-baseline.json`
- Escopo determinístico: `docs/plans/ui-complexity-scope.json`
- Allowlist: `docs/plans/ui-complexity-allowlist.json`
- Relatório comparativo: `docs/plans/ui-complexity-report.md`
- Script de baseline/report: `scripts/ui-complexity-report.mjs`
- Script de no-regression: `scripts/ui-complexity-allowlist-check.mjs`

## Baseline Oficial (Fase 1)
Fonte de verdade: `docs/plans/ui-complexity-baseline.md`.

Top offenders medidos por LOC/JSX/soft violations (snapshot atual):
1. `src/modules/process/ui/CreateProcessDialog.tsx`
2. `src/modules/process/ui/ShipmentView.tsx`
3. `src/modules/process/ui/CreateProcessDialog.view.tsx`
4. `src/capabilities/search/ui/SearchOverlay.panel.tsx`
5. `src/modules/process/ui/components/ShipmentHeader.tsx`
6. `src/modules/process/ui/components/TimelineNode.tsx`

## Escopo e Classificação
Definidos em `docs/plans/ui-complexity-scope.json`.

Regras práticas:
- `components`: visual puro (`ui/components/**`, `shared/ui/**`).
- `pages-like`: arquivos de tela/orquestração (`ui/screens/**`, `*View.tsx`, `*Dialog.tsx`, overrides explícitos).
- Se o arquivo combina fetch/query/resource + layout de tela, entra em `pages-like` via `pagesLikeOverrides`.

## Thresholds Ativos
### ESLint soft (script report)
- `max-lines-per-function = 180` (UI inteira)
- `components`: `complexity=15`, `max-depth=4`, `max-nested-callbacks=3`
- `pages-like`: `complexity=20`, `max-depth=5`, `max-nested-callbacks=4`

### ESLint hard (lint)
- `max-lines-per-function = 220` (UI inteira)
- `components`: `complexity=15`, `max-depth=4`, `max-nested-callbacks=3`
- `pages-like`: `complexity=20`, `max-depth=5`, `max-nested-callbacks=4`

### JSX metrics (script gate)
- `components`: `jsxDepth <= 6`, `jsxElements <= 120`
- `pages-like`: `jsxDepth <= 7`, `jsxElements <= 160`

## Decisão de Congelamento (2026-02-23)
- Thresholds soft/hard e métricas JSX ficam congelados no estado atual.
- Recalibração só é permitida com evidência objetiva:
  1. falso positivo recorrente em arquivo não-allowlisted, ou
  2. regressão de legibilidade confirmada por review técnico.
- Qualquer recalibração exige atualização explícita deste plano e do relatório comparativo.

## Política de Schema/Validation na UI
- `ui/components/**` não pode importar libs/schema/validation (`zod`, `yup`, `valibot`, `superstruct`, `arktype`) nem módulos internos `*schema*`/`*validation*`.
- `pages-like` não faz parsing/schema diretamente; delega para `ui/validation/**`.
- `ui/validation/**` é o único ponto para parsing/validação de UX na UI.
- `interface/http/**` mantém validação de request/response.
- `modules/*/domain/**` não usa schema libs.

## Allowlist e No-regression
Contrato: `docs/plans/ui-complexity-allowlist.json`.

Regras:
1. Arquivo na allowlist: métrica atual não pode piorar vs baseline registrada.
2. Arquivo fora da allowlist: deve respeitar thresholds atuais.
3. `expiresAt` vencido falha check.
4. Entrada sem `reason` falha check.

## Fases e Status
1. Fase 1 — Baseline e instrumentação: **concluída**
2. Fase 2 — Guidelines + primitives: **concluída no escopo planejado**
3. Fase 3 — Boundaries + schema/validation: **concluída (core)**
4. Fase 4 — Soft limits fora do lint principal: **concluída**
5. Fase 5 — Refactors guiados nos hotspots: **concluída no escopo priorizado**
6. Fase 6 — Hard-gate + CI script gate: **concluída**
7. Fase 7 — Gate completo + policy final de exceções: **concluída (allowlist=0, soft violations=0)**

## Operação Contínua
1. Manter `allowlist` em zero; novos entries só com motivo, issue e expiração.
2. Executar `ui:complexity:ci` no mesmo job do lint em toda PR.
3. Tratar exceções como temporárias e remover assim que o hotspot for refatorado.
