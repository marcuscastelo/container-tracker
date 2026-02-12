import { InfrastructureError } from '~/shared/errors/httpErrors'

type SupabaseLikeResult<T> = {
  data?: T | null
  error?: { message?: string; code?: string } | null
}

type Ctx = { operation?: string; table?: string; meta?: Record<string, unknown> }

function formatMsg(context?: Ctx) {
  return `Database error${context?.table ? ` on ${context.table}` : ''}${context?.operation ? ` during ${context.operation}` : ''}`
}

/** Strict: always returns T or throws. */
export function unwrapSupabaseResultOrThrow<T>(result: SupabaseLikeResult<T>, context?: Ctx): T {
  const { data, error } = result
  if (error) {
    const msg = formatMsg(context)
    console.error(msg, { context, error })
    throw new InfrastructureError(msg, error)
  }
  if (data == null) {
    const msg = `Missing data${context?.table ? ` on ${context.table}` : ''}${context?.operation ? ` during ${context.operation}` : ''}`
    console.error(msg, { context, result })
    throw new InfrastructureError(msg)
  }
  return data
}

/** Single-row "not found" becomes null, other errors throw. */
export function unwrapSupabaseSingleOrNull<T>(
  result: SupabaseLikeResult<T>,
  context?: Ctx,
): T | null {
  const { data, error } = result
  if (error) {
    if (error.code === 'PGRST116') return null
    const msg = formatMsg(context)
    console.error(msg, { context, error })
    throw new InfrastructureError(msg, error)
  }
  return data ?? null
}
