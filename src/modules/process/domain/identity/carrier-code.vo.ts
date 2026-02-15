import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

export type CarrierCode = ProcessBrand<string, 'CarrierCode'>

export function toCarrierCode(code: string): CarrierCode {
  return toProcessBrand<string, 'CarrierCode'>(code)
}
