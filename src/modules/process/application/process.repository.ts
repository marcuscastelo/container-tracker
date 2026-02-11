import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { Process } from '~/modules/process/domain/process'

// src/modules/process/domain/process.repository.ts
export type ProcessRepository = {
  fetchAll(): Promise<readonly Process[]>
  fetchById(processId: string): Promise<Process | null>

  create(record: InsertProcessRecord): Promise<Process>
  update(processId: string, record: UpdateProcessRecord): Promise<Process>

  delete(processId: string): Promise<void>
}
