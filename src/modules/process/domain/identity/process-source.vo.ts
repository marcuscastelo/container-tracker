import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

export type ProcessSource = ProcessBrand<string, 'ProcessSource'>

export function toProcessSource(source: string): ProcessSource {
  const normalized = source.trim().toLowerCase()
  return toProcessBrand<string, 'ProcessSource'>(normalized)
}
