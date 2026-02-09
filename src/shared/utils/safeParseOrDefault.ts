export type SafeParseResult<T> = { success: true; data: T } | { success: false; error: unknown }

import { formatParseError } from '~/shared/utils/formatParseError'

export function safeParseOrDefault<T>(
  value: unknown,
  schema: { safeParse: (v: unknown) => SafeParseResult<T> },
  defaultValue: T,
): T {
  if (!schema || typeof schema.safeParse !== 'function') {
    console.warn('Invalid schema provided to safeParseOrDefault, using default', { value, schema })
    return defaultValue
  }

  try {
    const result: SafeParseResult<T> = schema.safeParse(value)
    if (result && result.success) return result.data
    // Use debug level — callers use this function as a "try parse, else fallback"
    // pattern, so failures are expected and should not clutter production logs.
    console.debug('Failed to parse value, using default:', value)
    console.debug('Parse error details:', formatParseError(result?.error))
    return defaultValue
  } catch (e) {
    // If safeParse unexpectedly throws, fallback to default
    console.warn('safeParse threw an exception, using default:', value)
    console.warn('Exception details:', formatParseError(e))
    return defaultValue
  }
}
