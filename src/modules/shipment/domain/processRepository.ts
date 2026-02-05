import type {
  Process,
  ProcessContainer,
  ProcessWithContainers,
} from '~/modules/shipment/domain/process'

export type ProcessRepository = {
  fetchAll: () => Promise<readonly Process[]>
  fetchAllWithContainers: () => Promise<readonly ProcessWithContainers[]>
  fetchById: (processId: string) => Promise<Process | null>
  fetchByIdWithContainers: (processId: string) => Promise<ProcessWithContainers | null>
  fetchContainersByProcessId: (processId: string) => Promise<readonly ProcessContainer[]>
  containerExists: (containerNumber: string) => Promise<boolean>
  fetchContainerByNumber: (containerNumber: string) => Promise<ProcessContainer | null>
  create: (
    process: Omit<Process, 'id' | 'created_at' | 'updated_at'>,
    containers: readonly Omit<
      ProcessContainer,
      'id' | 'process_id' | 'created_at' | 'updated_at'
    >[],
  ) => Promise<ProcessWithContainers>
  addContainer: (
    processId: string,
    container: Omit<ProcessContainer, 'id' | 'process_id' | 'created_at' | 'updated_at'>,
  ) => Promise<ProcessContainer>
  update: (
    processId: string,
    updates: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ) => Promise<Process>
  delete: (processId: string) => Promise<void>
  removeContainer: (containerId: string) => Promise<void>
}
