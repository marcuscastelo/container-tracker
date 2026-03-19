import type { ContainerUseCases } from '~/modules/container/application/container.usecases'

export type ContainerUseCasesForProcess = Pick<
  ContainerUseCases,
  | 'checkExistence'
  | 'createManyForProcess'
  | 'reconcileForProcess'
  | 'deleteContainer'
  | 'findByNumbers'
  | 'listByProcessId'
  | 'listByProcessIds'
  | 'updateCarrier'
>
