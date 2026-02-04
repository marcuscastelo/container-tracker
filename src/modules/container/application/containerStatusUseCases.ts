import type { ContainerStatus } from '~/modules/container/domain/containerStatus'
import type { ContainerStatusRepository } from '~/modules/container/domain/containerStatusRepository'

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
      try {
        // Lightweight debug summary to help investigate missing events in DB.
        const s = status as Record<string, unknown>
        const containers = Array.isArray(s?.containers) ? (s.containers as unknown[]) : []
        const firstContainer =
          containers.length > 0 ? (containers[0] as Record<string, unknown>) : null
        const firstEvents = firstContainer ? firstContainer['events'] : undefined
        console.debug('containerStatusUseCases.saveContainerStatus:', {
          containerId,
          containers: containers.length,
          firstContainerEvents: Array.isArray(firstEvents)
            ? (firstEvents as unknown[]).length
            : (firstEvents ?? null),
        })
      } catch (_e) {
        /* ignore logging errors */
      }
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
