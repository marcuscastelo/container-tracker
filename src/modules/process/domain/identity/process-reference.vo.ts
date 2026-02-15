import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'
import { normalizeReference, validateReference } from '~/modules/process/domain/process.validation'

export type ProcessReference = ProcessBrand<string, 'ProcessReference'>

export function toProcessReference(reference: string): ProcessReference {
  validateReference(reference)
  const normalized = normalizeReference(reference)
  return toProcessBrand<string, 'ProcessReference'>(normalized)
}
