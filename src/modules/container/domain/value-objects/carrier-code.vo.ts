import { type Brand, toBrand } from '~/modules/container/domain/container.types'

export type CarrierCode = Brand<string, 'CarrierCode'>

export function toCarrierCode(code: string): CarrierCode {
  return toBrand<string, 'CarrierCode'>(code)
}
