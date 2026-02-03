/**
 * Parses a JSON string and throws a JS Error with stack trace on failure.
 * @param json - The JSON string to parse
 * @returns The parsed object
 * @throws Error with stack trace if parsing fails
 */
export function jsonParseWithStack<T = unknown>(json: string): T {
  try {
    // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/consistent-type-assertions
    return JSON.parse(json) as T
  } catch (err) {
    const error = new Error(err instanceof Error ? err.message : 'Invalid JSON')
    // Optionally attach the original error for debugging
    // @ts-expect-error Property originalError does not exist on type
    error.originalError = err
    throw error
  }
}
