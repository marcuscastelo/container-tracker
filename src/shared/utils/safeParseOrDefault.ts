export type SafeParseResult<T> = { success: true; data: T } | { success: false; error: unknown }
// Overload: accept either a parser function (legacy) or a schema-like object with safeParse
export function safeParseOrDefault<T>(value: unknown, parser: (v: unknown) => T, defaultValue: T): T
export function safeParseOrDefault<T>(
  value: unknown,
  schema: { safeParse: (v: unknown) => SafeParseResult<T> },
  defaultValue: T,
): T

export function safeParseOrDefault<T>(value: unknown, schemaOrParser: any, defaultValue: T): T {
  // If a function was passed (legacy .parse functions), call it and catch exceptions
  if (typeof schemaOrParser === 'function') {
    try {
      return schemaOrParser(value)
    } catch (e) {
      console.warn('Failed to parse value, using default:', { value, error: e })
      return defaultValue
    }
  }

  // Otherwise expect an object with safeParse
  if (schemaOrParser && typeof schemaOrParser.safeParse === 'function') {
    try {
      const result: SafeParseResult<T> = schemaOrParser.safeParse(value)
      if (result && (result as SafeParseResult<T>).success) return (result as any).data as T
      console.warn('Failed to parse value, using default:', {
        value,
        error: (result as any)?.error,
      })
      return defaultValue
    } catch (e) {
      // If safeParse unexpectedly throws, fallback to default
      console.warn('safeParse threw an exception, using default:', { value, error: e })
      return defaultValue
    }
  }

  // Unknown schemaOrParser shape: return default
  console.warn('Invalid schema or parser provided to safeParseOrDefault, using default', {
    value,
    schemaOrParser,
  })
  return defaultValue
}
