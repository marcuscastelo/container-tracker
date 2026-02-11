import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'

export type ContainerAggregate = {
  container: ContainerEntity
  timeline: unknown[]
  status: ContainerStatus
  alerts: unknown[]
}
