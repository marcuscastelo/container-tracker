import { z } from 'zod'

const ZodErrorLikeSchema = z.object({
  issues: z.array(z.unknown()),
})

const ErrorsLikeSchema = z.object({
  errors: z.array(z.unknown()),
})

const DetailsLikeSchema = z.object({
  details: z.unknown(),
})

export function formatParseError(err: unknown): string {
  try {
    if (err && typeof err === 'object') {
      const zodResult = ZodErrorLikeSchema.safeParse(err)
      if (zodResult.success) {
        return JSON.stringify(zodResult.data.issues, null, 2)
      }

      const errorsResult = ErrorsLikeSchema.safeParse(err)
      if (errorsResult.success) {
        return JSON.stringify(errorsResult.data.errors, null, 2)
      }

      const detailsResult = DetailsLikeSchema.safeParse(err)
      if (detailsResult.success) {
        return JSON.stringify(detailsResult.data.details, null, 2)
      }
    }

    // Fallback to a readable string representation
    if (err instanceof Error) return `${err.name}: ${err.message}`
    return typeof err === 'string' ? err : JSON.stringify(err, null, 2)
  } catch (_e) {
    // In case formatting fails, return a safe fallback
    try {
      return String(err)
    } catch (_) {
      return '[unstringifiable error]'
    }
  }
}
