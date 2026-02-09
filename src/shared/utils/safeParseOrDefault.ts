export type SafeParseResult<T> = { success: true; data: T } | { success: false; error: unknown }

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
    console.warn('Failed to parse value, using default:', { value, error: result?.error })
    return defaultValue
  } catch (e) {
    // If safeParse unexpectedly throws, fallback to default
    console.warn('safeParse threw an exception, using default:', { value, error: e })
    return defaultValue
  }
}
