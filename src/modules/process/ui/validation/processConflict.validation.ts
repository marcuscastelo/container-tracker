import z from 'zod'
import { TypedFetchError } from '~/shared/api/typedFetch'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'
import { isRecord } from '~/shared/utils/typeGuards'

const unknownRecordSchema = z.record(z.string(), z.unknown())

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  return safeParseOrDefault(value, unknownRecordSchema, null)
}

export type ExistingProcessConflict = {
  readonly message: string
  readonly processId?: string
  readonly containerId?: string
  readonly containerNumber?: string
}

function parseExistingProcessConflict(value: unknown): ExistingProcessConflict | null {
  const body = parseRecord(value)
  if (!body || !('existing' in body)) return null

  const existing = parseRecord(body.existing)
  if (!existing) return null

  const messageFromBody =
    (isRecord(body) && typeof body.message === 'string' && body.message) ||
    (isRecord(body) && typeof body.error === 'string' && body.error)

  return {
    message: messageFromBody || 'Container already exists',
    processId: toOptionalString(existing.processId ?? existing.process_id),
    containerId: toOptionalString(existing.containerId ?? existing.container_id),
    containerNumber: toOptionalString(existing.containerNumber ?? existing.container_number),
  }
}

export function parseExistingProcessConflictError(error: unknown): ExistingProcessConflict | null {
  if (error instanceof TypedFetchError && error.status === 409) {
    return parseExistingProcessConflict(error.body)
  }
  return parseExistingProcessConflict(error)
}
