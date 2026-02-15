import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'

export type ContainerId = ContainerBrand<string, 'ContainerId'>

export function toContainerId(id: string): ContainerId {
  return toContainerBrand<string, 'ContainerId'>(id)
}
