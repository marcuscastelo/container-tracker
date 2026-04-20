import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

export function requireTimestamptz(value: unknown, field: string, context: string): string {
  const normalized = normalizeTimestamptz(value)
  if (normalized === null) {
    throw new Error(`${context}: ${field} is not a valid timestamp: ${String(value)}`)
  }
  return normalized
}
