import type { ContainerEntity } from '~/modules/container/domain/container.entity'
import type { ProcessEntity } from '~/modules/process/domain/process.entity'

export type ProcessWithContainers = Readonly<{
  process: ProcessEntity
  containers: readonly ContainerEntity[]
}>
