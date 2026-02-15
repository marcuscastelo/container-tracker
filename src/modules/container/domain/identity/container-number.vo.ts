import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'

export type ContainerNumber = ContainerBrand<string, 'ContainerNumber'>

export function toContainerNumber(number: string): ContainerNumber {
  return toContainerBrand<string, 'ContainerNumber'>(number)
}
