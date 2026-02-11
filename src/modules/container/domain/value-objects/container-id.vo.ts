import { type Brand, toBrand } from '~/modules/container/domain/container.types'

export type ContainerId = Brand<string, 'ContainerId'>

export function toContainerId(id: string): ContainerId {
  return toBrand<string, 'ContainerId'>(id)
}
