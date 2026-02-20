# Baseline Tecnico - refactor/separate-bc-from-capabilities

- Capturado em: `2026-02-20 14:08:09 -0300`
- Branch: `refactor/separate-bc-from-capabilities`
- Workspace: `/home/marucs/Development/Castro/container-tracker`

## Scan de boundaries (antes da execucao)

### Rotas importando camadas internas

```txt
src/routes/api/refresh.ts:1:import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
src/routes/api/refresh.ts:2:import { sanitizePayload } from '~/modules/tracking/application/apiHelpers'
src/routes/api/refresh.ts:3:import type { Provider } from '~/modules/tracking/domain/model/provider'
src/routes/api/refresh.ts:4:import { PROVIDERS } from '~/modules/tracking/domain/model/provider'
src/routes/api/refresh.ts:5:import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
src/routes/api/refresh.ts:6:import { isRestCarrier } from '~/modules/tracking/infrastructure/carriers/fetchers/is-rest-carrier'
src/routes/api/refresh-maersk/[container].ts:7:import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
src/routes/api/refresh-maersk/[container].ts:8:import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
```

### Cross-BC domain imports (process)

```txt
src/modules/process/interface/http/process.http.mappers.ts:1:import type { ContainerEntity } from '~/modules/container/domain/container.entity'
src/modules/process/interface/http/process.http.mappers.ts:10:import type { Observation } from '~/modules/tracking/domain/model/observation'
src/modules/process/interface/http/process.http.mappers.ts:11:import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
src/modules/process/ui/CreateProcessDialog.tsx:4:import { findDuplicateContainers } from '~/modules/container/domain/container.validation'
src/modules/process/ui/components/PredictionHistoryModal.tsx:8:} from '~/modules/tracking/domain/reconcile/seriesClassification'
src/modules/process/application/process.readmodels.ts:1:import type { ContainerEntity } from '~/modules/container/domain/container.entity'
src/modules/process/application/errors.ts:1:import type { ContainerEntity } from '~/modules/container/domain/container.entity'
src/modules/process/application/operational-projection/processOperationalSummary.ts:1:import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
src/modules/process/application/operational-projection/deriveProcessStatus.ts:4:} from '~/modules/tracking/domain/model/containerStatus'
src/modules/process/application/process.presenter.ts:20:} from '~/modules/tracking/domain/model/containerStatus'
src/modules/process/application/operational-projection/__tests__/aggregateOperationalSummary.test.ts:3:import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
src/modules/process/application/operational-projection/__tests__/aggregateOperationalSummary.test.ts:4:import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
src/modules/process/application/usecases/create-process.usecase.ts:1:import type { ContainerEntity } from '~/modules/container/domain/container.entity'
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:6:import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
src/modules/process/application/usecases/list-processes-with-operational-summary.usecase.ts:7:import type { TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
```

### Container importando process module

```txt
src/modules/container/application/usecases/reconcile-containers.usecase.ts:9:} from '~/modules/process/application/errors'
src/modules/container/application/usecases/create-many-containers.usecase.ts:7:import { DuplicateContainersError } from '~/modules/process/application/errors'
src/modules/container/application/usecases/delete-container.usecase.ts:2:import { CannotRemoveLastContainerError } from '~/modules/process/application/errors'
```

### Application importando shared/api-schemas

```txt
src/modules/tracking/application/projection/tracking.timeline.readmodel.ts:9:import type { ObservationResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/tracking/application/projection/tracking.alert.presenter.ts:1:import type { TrackingAlertResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/application/process.presenter.ts:21:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
src/modules/process/application/tests/processPresenter.test.ts:3:import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'
```

### Modules importando capability

```txt
src/modules/process/ui/screens/DashboardScreen.tsx:5:import { SearchOverlay } from '~/capabilities/search/ui/SearchOverlay'
```

## Estado dos comandos antes da execucao

### `pnpm run lint`

```txt
Checked 254 files in 429ms. No fixes applied.
```

### `pnpm run type-check`

```txt
src/modules/process/application/tests/processPresenter.test.ts(55,45): error TS2339: Property 'label' does not exist on type 'TrackingTimelineItem'.
src/modules/process/application/tests/processPresenter.test.ts(56,45): error TS2339: Property 'label' does not exist on type 'TrackingTimelineItem'.
```

### `pnpm run test`

```txt
FAIL src/modules/process/application/tests/processPresenter.test.ts > processPresenter > presents a minimal API payload into shipment detail
AssertionError: ... timeline[0].label ...
```

## Baseline target imediato (Fase 1)

1. Corrigir `processPresenter.test.ts` para shape atual de `TrackingTimelineItem`.
2. Colocar `type-check` e `test` verdes antes das fases estruturais.
