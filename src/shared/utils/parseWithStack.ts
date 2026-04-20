import { ZodError, z } from 'zod/v4'

/**
 * Parses data with a Zod schema and always throws a JS Error with stack trace on failure.
 * @param schema - The Zod schema to use for parsing
 * @param data - The data to parse
 * @returns The parsed data if valid
 * @throws Error with stack trace and Zod issues if invalid
 */
export function parseWithStack<T extends z.core.$ZodType>(schema: T, data: unknown): z.output<T> {
  try {
    return z.parse(schema, data)
  } catch (err) {
    if (err instanceof ZodError) {
      const error = new Error(err.message)
      if (err.stack !== undefined) {
        error.stack = err.stack
      }
      // Attach Zod issues for debugging
      // @ts-expect-error: Forced typing
      error.issues = err.issues
      throw error
    }
    throw err
  }
}
