import { z, ZodError } from 'zod/v4'

/**
 * Parses data with a Zod schema and always throws a JS Error with stack trace on failure.
 * @param schema - The Zod schema to use for parsing
 * @param data - The data to parse
 * @returns The parsed data if valid
 * @throws Error with stack trace and Zod issues if invalid
 */
export function parseWithStack<T extends z.core.$ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  try {
    // eslint-disable-next-line no-restricted-syntax
    return z.parse(schema, data)
  } catch (err) {
    if (err instanceof ZodError) {
      const error = new Error(err.message)
      error.stack = err.stack // preserve original stack trace
      // Attach Zod issues for debugging
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
      ;(error as any).issues = err.issues
      throw error
    }
    throw err
  }
}
