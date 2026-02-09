export function formatParseError(err: unknown): string {
  try {
    // ZodError has `issues` array which is more useful than the generic message
    if (err && typeof err === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = err as any
      if (Array.isArray(anyErr.issues)) {
        return JSON.stringify(anyErr.issues, null, 2)
      }
      // Some libraries put useful data on `error.errors` or `error.details`
      if (Array.isArray(anyErr.errors)) {
        return JSON.stringify(anyErr.errors, null, 2)
      }
      if (anyErr.details) {
        return JSON.stringify(anyErr.details, null, 2)
      }
    }

    // Fallback to a readable string representation
    if (err instanceof Error) return `${err.name}: ${err.message}`
    return typeof err === 'string' ? err : JSON.stringify(err, null, 2)
  } catch (e) {
    // In case formatting fails, return a safe fallback
    try {
      return String(err)
    } catch (_) {
      return '[unstringifiable error]'
    }
  }
}
