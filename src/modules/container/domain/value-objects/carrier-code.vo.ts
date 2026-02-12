import { type ContainerBrand, toContainerBrand } from '~/modules/container/domain/container.types'

export type CarrierCode = ContainerBrand<string, 'CarrierCode'>

export function toCarrierCode(code: string): CarrierCode {
  return toContainerBrand<string, 'CarrierCode'>(code)
}
