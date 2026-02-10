import {
  parseDateFromNumber,
  parseIsoOrRfcString,
  parseMsDateString,
} from '~/shared/utils/parseDate'

/**
 * Normalize various timestamptz representations returned by Supabase into
 * an ISO UTC datetime string, or null if the value is not parseable.
 *
 * Accepts:
 *  - Date objects
 *  - numeric epoch (ms)
 *  - MS /Date(123456789)/ strings
 *  - ISO / RFC string representations
 */
export function normalizeTimestamptz(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    const d = parseDateFromNumber(value)
    return d ? d.toISOString() : null
  }
  if (typeof value === 'string') {
    const ms = parseMsDateString(value)
    if (ms) return ms.toISOString()
    const iso = parseIsoOrRfcString(value)
    if (iso) return iso.toISOString()
    return null
  }
  return null
}
