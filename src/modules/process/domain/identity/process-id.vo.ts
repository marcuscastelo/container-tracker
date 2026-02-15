import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

export type ProcessId = ProcessBrand<string, 'ProcessId'>

export function toProcessId(id: string): ProcessId {
  return toProcessBrand<string, 'ProcessId'>(id)
}
