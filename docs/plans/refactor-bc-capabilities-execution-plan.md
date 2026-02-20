# Plano Final v2 - Refactor BC/Capabilities

## Resumo
Plano em 9 fases com 5 reforcos incorporados:

1. `refresh`/`maersk` com controller fino e 1 usecase por endpoint.
2. `TrackingObservationDTO` como modelo de projecao (nao espelho HTTP).
3. `ProcessOperationalSummary` com contrato semantico explicito.
4. `shared/errors` minimo e neutro.
5. ESLint boundaries somente depois de tudo verde, antes da validacao final.

## APIs/contratos que mudam

1. Novo endpoint canonico: `POST /api/containers/check`.
2. Remocao de `POST /api/processes/check`.
3. `POST /api/refresh` e `GET/POST /api/refresh-maersk/[container]` preservam contrato externo atual.

## Fase 1 - Baseline + artefatos

1. Salvar plano em `docs/plans/refactor-bc-capabilities-execution-plan.md`.
2. Salvar baseline tecnico em `docs/plans/refactor-bc-capabilities-baseline.md`.
3. Corrigir baseline vermelho atual em `src/modules/process/application/tests/processPresenter.test.ts`.
4. Criterio: `processPresenter` alinhado ao `TrackingTimelineItem` atual.

## Fase 2 - Refresh architecture hard-boundary

1. Criar controllers HTTP de refresh em tracking interface (`refresh.controllers.ts`) com regra: cada handler chama exatamente 1 usecase.
2. Criar/ajustar usecases de aplicacao para refresh REST e refresh Maersk (sem logica Puppeteer no controller).
3. Extrair Puppeteer/Akamai/diagnostics para infraestrutura (`tracking/infrastructure/carriers/*`).
4. Deixar `src/routes/api/refresh.ts` e `src/routes/api/refresh-maersk/[container].ts` como adapters finos.
5. Criterio: rotas sem imports de `application|domain|infrastructure`; controller sem orquestracao extra.

## Fase 3 - Container interface/http + migracao de endpoint

1. Criar `src/modules/container/interface/http/*` (`schemas`, `mappers`, `controllers`, `bootstrap`).
2. Criar `src/routes/api/containers/check.ts`.
3. Remover `src/routes/api/processes/check.ts`.
4. Atualizar `src/modules/process/ui/CreateProcessDialog.tsx` para novo endpoint.
5. Criterio: fluxo de conflito de container segue igual no UI.

## Fase 4 - TrackingObservationDTO real de projecao

1. Criar DTO interno em `tracking/application/projection` com shape semantico de projecao (nao copia de `ObservationResponse`).
2. Refatorar `tracking.timeline.readmodel.ts` para consumir esse DTO.
3. Criar mapper explicito de entrada (domain/record -> projection DTO).
4. Criterio: `tracking/application/**` sem dependencia de `shared/api-schemas`.

## Fase 5 - Tightening de ProcessOperationalSummary

1. Introduzir tipos semanticos locais no process application (`OperationalStatus`, `OperationalAlertSeverity`).
2. Criar tradutor explicito de status/severity vindos de tracking para esses tipos.
3. Refatorar `operational-projection/*` e `list-processes-with-operational-summary.usecase.ts` para usar so contrato local.
4. Criterio: zero import de `tracking/domain` dentro de `process/application/operational-projection`.

## Fase 6 - Erros compartilhados minimos

1. Criar `src/shared/errors/container-process.errors.ts` so com erros neutros (conflito/duplicidade/remocao invalida).
2. Remover dependencia de `ContainerEntity`/VOs nesses erros.
3. Ajustar imports em container/process e `src/shared/api/errorToResponse.ts`.
4. Criterio: `src/modules/container/**` sem import de `src/modules/process/**`.

## Fase 7 - Limpeza de boundary em UI/modules

1. Remover import de domain em UI (`CreateProcessDialog`, `PredictionHistoryModal`).
2. Mover helpers de validacao/classificacao para application/shared adequados.
3. Remover dependencia `modules -> capabilities` (`DashboardScreen` deixa de importar `SearchOverlay`; composicao passa para `routes/index.tsx`).
4. Criterio: `src/modules/**` sem import de `src/capabilities/**`.

## Fase 8 - ESLint boundary rules (gated)

1. Pre-condicao obrigatoria: `lint + type-check + test` verdes apos Fase 7.
2. Endurecer `eslint.config.mjs` com `no-restricted-imports` por camada/BC.
3. Atualizar referencias canonicas para `docs/TYPE_ARCHITECTURE.md` em `AGENTS.md`, `src/modules/tracking/AGENTS.md`, `src/modules/README.md`.
4. Limpar diretorios vazios de locale espelho (`src/locales/capabilities/search/**`).
5. Criterio: regras ativas sem travar refactor em andamento.

## Fase 9 - Validacao final + relatorio

1. Rodar `pnpm run lint`, `pnpm run type-check`, `pnpm run test`, `pnpm run i18n:check`.
2. Adicionar testes dos novos controllers/rotas e cenarios de refresh/container-check.
3. Gerar `docs/plans/refactor-bc-capabilities-report.md` com before/after dos scans de boundary.
4. Criterio: branch verde e relatorio de fechamento completo.

## Cenarios de teste minimos obrigatorios

1. `POST /api/refresh` com REST carrier.
2. `POST /api/refresh` com `maersk` (redirect).
3. `GET/POST /api/refresh-maersk/[container]` preservando comportamento de captura/diagnostico.
4. `POST /api/containers/check` com e sem conflito.
5. Timeline series: ACTUAL vs EXPECTED, expiracao, conflito de ACTUAL.
6. `aggregateOperationalSummary` sem drift semantico.
7. Boundary scans sem violacoes criticas.

## Assumptions e defaults

1. Caminho canonico de tipos: `docs/TYPE_ARCHITECTURE.md`.
2. Manter comportamento atual do fluxo Maersk.
3. Sem alias temporario para `/api/processes/check` (migracao direta).
4. Sem migracao de banco nesta rodada.
5. Commits recomendados: 1 commit por fase.
