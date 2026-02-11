import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { Process } from '~/modules/process/domain/process'
import type { ProcessContainer, ProcessWithContainers } from '~/modules/process/domain/processStuff'

// src/modules/process/domain/process.repository.ts
export type ProcessRepository = {
  fetchAll(): Promise<readonly Process[]>
  fetchAllWithContainers(): Promise<readonly ProcessWithContainers[]>

  fetchById(processId: string): Promise<Process | null>
  fetchByIdWithContainers(processId: string): Promise<ProcessWithContainers | null>

  fetchContainersByProcessId(processId: string): Promise<readonly ProcessContainer[]>

  containerExists(containerNumber: string): Promise<boolean>
  fetchContainerByNumber(containerNumber: string): Promise<ProcessContainer | null>

  create(record: InsertProcessRecord): Promise<Process>
  update(processId: string, record: UpdateProcessRecord): Promise<Process>

  delete(processId: string): Promise<void>
  removeContainer(containerId: string): Promise<void>
}
