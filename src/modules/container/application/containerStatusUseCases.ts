import type { ContainerStatus } from '~/src/modules/container/domain/containerStatus'
import type { ContainerStatusRepository } from '~/src/modules/container/domain/containerStatusRepository'

export type ContainerStatusUseCases = {
  getAllContainerStatuses: () => Promise<readonly ContainerStatus[]>
  getContainerStatus: (containerId: string) => Promise<ContainerStatus | null>
  saveContainerStatus: (
    containerId: string,
    status: Record<string, unknown>,
  ) => Promise<ContainerStatus>
  deleteContainerStatus: (containerId: string) => Promise<void>
}

export function createContainerStatusUseCases(
  repository: ContainerStatusRepository,
): ContainerStatusUseCases {
  return {
    async getAllContainerStatuses(): Promise<readonly ContainerStatus[]> {
      return repository.fetchAll()
    },

    async getContainerStatus(containerId: string): Promise<ContainerStatus | null> {
      return repository.fetchById(containerId)
    },

    async saveContainerStatus(
      containerId: string,
      status: Record<string, unknown>,
    ): Promise<ContainerStatus> {
      // Preserve existing carrier if present, otherwise default to 'UNKNOWN'
      const existing = await repository.fetchById(containerId)
      const carrier = existing?.carrier ?? 'UNKNOWN'
      return repository.upsert({ container_id: containerId, carrier, status })
    },

    async deleteContainerStatus(containerId: string): Promise<void> {
      return repository.delete(containerId)
    },
  }
}
