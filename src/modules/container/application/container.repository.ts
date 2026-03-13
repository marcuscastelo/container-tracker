import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ContainerEntity } from '~/modules/container/domain/container.entity'

export type InsertContainerRecord = {
  processId: string
  containerNumber: string
  carrierCode: string
}

export type UpdateContainerRecord = {
  id: string
  containerNumber: string
  carrierCode: string
}

export type ContainerRepository = {
  insert(record: InsertContainerRecord): Promise<ContainerEntity>
  insertMany(records: InsertContainerRecord[]): Promise<ContainerEntity[]>
  updateCarrierCode(command: {
    readonly id: string
    readonly carrierCode: string
  }): Promise<ContainerEntity>
  delete(id: string): Promise<void>
  existsMany(numbers: string[]): Promise<Map<string, boolean>>
  findByNumber(containerNumber: string): Promise<ContainerEntity | null>
  findByNumbers(numbers: string[]): Promise<ContainerEntity[]>
  listSearchProjections(): Promise<readonly ContainerSearchProjection[]>
  listByProcessId(processId: string): Promise<readonly ContainerEntity[]>
  listByProcessIds(
    processIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ContainerEntity[]>>
}
