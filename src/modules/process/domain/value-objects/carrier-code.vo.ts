import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

export type CarrierCode = ProcessBrand<string, 'CarrierCode'>

export function toCarrierCode(code: string): CarrierCode {
  const normalized = code.trim().toUpperCase()
  return toProcessBrand<string, 'CarrierCode'>(normalized)
}
