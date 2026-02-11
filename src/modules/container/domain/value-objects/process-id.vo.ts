import { type Brand, toBrand } from '~/modules/container/domain/container.types'

export type ProcessId = Brand<string, 'ProcessId'>

export function toProcessId(id: string): ProcessId {
  return toBrand<string, 'ProcessId'>(id)
}
