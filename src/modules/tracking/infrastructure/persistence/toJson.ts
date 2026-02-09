import type { Json } from '~/shared/supabase/database.types'

/**
 * Safely coerce a value to the Supabase `Json` type without using `as`.
 *
 * The Supabase `Json` type is `string | number | boolean | null | { [key: string]: Json | undefined } | Json[]`.
 * Our domain uses `unknown` for raw payloads. This function validates the runtime shape
 * and returns a `Json`-compatible value, falling back to `null` for incompatible shapes.
 *
 * Uses structural validation (type guards) instead of type assertions.
 */
export function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(toJson)
  if (typeof value === 'object') {
    const result: Record<string, Json | undefined> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = toJson(v)
    }
    return result
  }
  // Functions, symbols, bigints, etc. — cannot represent as JSON
  return null
}

/**
 * Convert a `string[]` to a `Json`-compatible value (a `Json[]`).
 *
 * Used for fields like `source_observation_fingerprints` where the domain type
 * is `string[]` but the DB column is `jsonb` (typed as `Json`).
 */
export function stringsToJson(values: readonly string[]): Json {
  return values.map((v): Json => v)
}
