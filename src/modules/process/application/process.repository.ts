import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'

// src/modules/process/domain/process.repository.ts
export type ProcessRepository = {
  fetchAll(): Promise<readonly ProcessEntity[]>
  fetchById(processId: string): Promise<ProcessEntity | null>

  create(record: InsertProcessRecord): Promise<ProcessEntity>
  update(processId: string, record: UpdateProcessRecord): Promise<ProcessEntity>

  delete(processId: string): Promise<void>
}
