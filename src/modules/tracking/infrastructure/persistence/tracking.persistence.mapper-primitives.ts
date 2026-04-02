import type { Provider } from '~/modules/tracking/domain/model/provider'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

const PROVIDER_MAP: Record<string, Provider> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
  pil: 'pil',
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tracking persistence mapper: ${field} is required but got ${String(value)}`)
  }
  return value
}

export function requireProvider(value: unknown, field: string): Provider {
  const s = requireString(value, field)
  const mapped = PROVIDER_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid provider: ${s}`)
  }
  return mapped
}

export function optionalProvider(value: unknown, field: string): Provider | null {
  if (value === null || value === undefined) return null
  return requireProvider(value, field)
}

export function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`tracking persistence mapper: ${field} is required but got ${String(value)}`)
  }
  return value
}

export function optionalFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireTimestamp(value: unknown, field: string): string {
  const normalized = normalizeTimestamptz(value)
  if (normalized === null) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid timestamp: ${String(value)}`,
    )
  }
  return normalized
}

/**
 * Normalize ISO timestamps that may have offsets or space-separated formats
 * into canonical UTC ISO strings. Used for alert timestamps.
 */
export function normalizeAlertIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const s = value.trim()
    if (s === '') return null
    const candidate = s.replace(/^(.+?) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/, '$1T$2$3')
    const d = new Date(candidate)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    return null
  }
  return null
}
