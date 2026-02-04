import type { ContainerStatus } from '~/modules/container/domain/containerStatus'

export type ContainerStatusRepository = {
  /**
   * Fetch all container statuses from storage
   */
  fetchAll: () => Promise<readonly ContainerStatus[]>

  /**
   * Fetch a single container status by container_id
   */
  fetchById: (containerId: string) => Promise<ContainerStatus | null>

  /**
   * Insert or update (upsert) a container status
   */
  upsert: (containerStatus: ContainerStatus) => Promise<ContainerStatus>

  /**
   * Delete a container status by container_id
   */
  delete: (containerId: string) => Promise<void>
}
