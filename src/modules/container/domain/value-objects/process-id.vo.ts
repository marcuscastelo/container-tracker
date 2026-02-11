import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'

export type ProcessId = ContainerBrand<string, 'ProcessId'>

export function toProcessId(id: string): ProcessId {
  return toContainerBrand<string, 'ProcessId'>(id)
}
