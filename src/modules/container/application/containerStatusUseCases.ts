import type { ContainerStatus } from '../domain/containerStatus'
import type { ContainerStatusRepository } from '../domain/containerStatusRepository'

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
      return repository.upsert({
        container_id: containerId,
        status,
      })
    },

    async deleteContainerStatus(containerId: string): Promise<void> {
      return repository.delete(containerId)
    },
  }
}
