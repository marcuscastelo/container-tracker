# Relatorio de Execucao - Refactor BC/Capabilities

- Data: `2026-02-20`
- Branch: `refactor/separate-bc-from-capabilities`
- Plano base: `docs/plans/refactor-bc-capabilities-execution-plan.md`
- Baseline base: `docs/plans/refactor-bc-capabilities-baseline.md`

## Status por fase

1. Fase 1 - Baseline + artefato de plano: **concluida**
2. Fase 2 - Refresh architecture hard-boundary: **concluida**
3. Fase 3 - Container interface/http + migracao de endpoint: **concluida**
4. Fase 4 - TrackingObservationDTO real de projecao: **concluida**
5. Fase 5 - Tightening de ProcessOperationalSummary: **concluida**
6. Fase 6 - Erros compartilhados minimos: **concluida**
7. Fase 7 - Limpeza de boundary em UI/modules: **concluida**
8. Fase 8 - ESLint boundary rules (gated): **concluida**
9. Fase 9 - Validacao final + relatorio: **concluida**

## Contratos/API aplicados

1. Adicionado endpoint canonico `POST /api/containers/check`.
2. Removido endpoint `POST /api/processes/check`.
3. Mantido contrato externo de `POST /api/refresh` e `GET/POST /api/refresh-maersk/[container]`.

## Before/After - scans de boundary (criticos)

### 1) Rotas importando `application|infrastructure|domain`

- Comando: `rg "modules/(.*)/(application|infrastructure|domain)" src/routes -n`
- Before (baseline): havia matches em `src/routes/api/refresh.ts` e `src/routes/api/refresh-maersk/[container].ts`.
- After: **0 matches**.

### 2) Tracking application importando `shared/api-schemas`

- Comando: `rg "shared/api-schemas" src/modules/tracking/application -n`
- Before (baseline): havia matches em `tracking.timeline.readmodel.ts` e `tracking.alert.presenter.ts`.
- After: **0 matches**.

### 3) Process operational projection importando `tracking/domain`

- Comando: `rg "modules/tracking/domain" src/modules/process/application/operational-projection -n`
- Before (baseline): havia matches em `processOperationalSummary.ts`, `deriveProcessStatus.ts` e testes.
- After: **0 matches**.

### 4) Container importando Process module

- Comando: `rg "modules/process" src/modules/container -n`
- Before (baseline): havia matches em `create-many-containers.usecase.ts`, `delete-container.usecase.ts`, `reconcile-containers.usecase.ts`.
- After: **0 matches**.

### 5) Modules importando capability

- Comando: `rg "capabilities/" src/modules -n`
- Before (baseline): havia match em `src/modules/process/ui/screens/DashboardScreen.tsx`.
- After: **0 matches**.

### 6) Domain importando interface/http/routes/shared-ui

- Comando: `rg "shared/ui|interface/http|routes" src/modules/**/domain -n`
- Before: sem violacoes criticas registradas.
- After: **0 matches**.

### 7) Process importando domain de outros BCs

- Comando: `rg "modules/(container|tracking)/domain" src/modules/process -n`
- Before (baseline): havia multiplos matches em `process/application`, `process/interface/http` e `process/ui`.
- After: **0 matches**.

## Mudancas estruturais principais

1. Refresh HTTP controllers criados em `src/modules/tracking/interface/http/refresh.controllers.ts` e bootstrap em `src/modules/tracking/interface/http/refresh.controllers.bootstrap.ts`.
2. Rotas `src/routes/api/refresh.ts` e `src/routes/api/refresh-maersk/[container].ts` convertidas para adapters finos.
3. Use cases dedicados de refresh criados:
   - `src/modules/tracking/application/usecases/refresh-rest-container.usecase.ts`
   - `src/modules/tracking/application/usecases/refresh-maersk-container.usecase.ts`
4. Infra de Maersk/Puppeteer extraida para `src/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher.ts`.
5. Interface HTTP de container criada em `src/modules/container/interface/http/*`.
6. Endpoint novo `src/routes/api/containers/check.ts`.
7. DTO interno de projecao criado em `src/modules/tracking/application/projection/tracking.observation.dto.ts`.
8. Contrato semantico operacional local criado em `src/modules/process/application/operational-projection/operationalSemantics.ts`.
9. Erros compartilhados neutros criados em `src/shared/errors/container-process.errors.ts`.
10. Regras de boundary reforcadas em `eslint.config.mjs`.
11. Referencias canonicas para `docs/TYPE_ARCHITECTURE.md` atualizadas em:
    - `AGENTS.md`
    - `src/modules/tracking/AGENTS.md`
    - `src/modules/README.md`
12. Locale mirror vazio removido (`src/locales/capabilities/search/**`).

## Testes adicionados nesta rodada

1. `src/modules/container/interface/http/container.controllers.test.ts`
2. `src/modules/tracking/interface/http/refresh.controllers.test.ts`
3. `src/routes/api/refresh.route.test.ts`
4. `src/routes/api/containers/check.route.test.ts`

## Validacao final

Executado em sequencia:

1. `pnpm run lint`
2. `pnpm run type-check`
3. `pnpm run test`
4. `pnpm run i18n:check`

Resultado:

- `lint`: **ok**
- `type-check`: **ok**
- `test`: **ok** (25 arquivos / 255 testes)
- `i18n:check`: **ok** (sem chaves ausentes; apenas avisos de chaves nao usadas e 2 falsos positivos de string de data detectada como key)

## Observacoes finais

1. O endpoint antigo `POST /api/processes/check` foi removido sem alias temporario, conforme plano.
2. O fluxo externo de refresh foi preservado com controllers finos e orquestracao/infra isoladas.
3. As regras de boundary foram habilitadas apos estado verde para evitar bloquear o refactor em andamento.
