import type { ContainerUseCases } from '~/modules/container/application/container.usecases'
import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'

type ListByProcessIdForProcess = (command: { readonly processId: string }) => Promise<{
  readonly containers: readonly ProcessContainerRecord[]
}>

type ListByProcessIdsForProcess = (command: { readonly processIds: readonly string[] }) => Promise<{
  readonly containersByProcessId: ReadonlyMap<string, readonly ProcessContainerRecord[]>
}>

export type ContainerUseCasesForProcess = Pick<
  ContainerUseCases,
  | 'checkExistence'
  | 'createManyForProcess'
  | 'reconcileForProcess'
  | 'deleteContainer'
  | 'findByNumbers'
> & {
  readonly listByProcessId: ListByProcessIdForProcess
  readonly listByProcessIds: ListByProcessIdsForProcess
}
