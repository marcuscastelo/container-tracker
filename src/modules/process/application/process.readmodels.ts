import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { Process } from '~/modules/process/domain/process'

export type ProcessWithContainers = Readonly<{
  process: Process
  containers: readonly ContainerEntity[]
}>
