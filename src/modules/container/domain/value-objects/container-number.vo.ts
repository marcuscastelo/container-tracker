import { type Brand, toBrand } from '~/modules/container/domain/container.types'

export type ContainerNumber = Brand<string, 'ContainerNumber'>

export function toContainerNumber(number: string): ContainerNumber {
  return toBrand<string, 'ContainerNumber'>(number)
}
