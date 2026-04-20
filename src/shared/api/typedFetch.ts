import { z } from 'zod'
import { reportHttpFailure, reportHttpSuccess } from '~/shared/api/httpDegradationReporter'

export class TypedFetchError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
    Object.setPrototypeOf(this, TypedFetchError.prototype)
  }
}

export async function typedFetch<T extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  responseSchema: T,
): Promise<z.infer<T>> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (error) {
    reportHttpFailure({ error })
    throw error
  }

  if (res.ok) {
    reportHttpSuccess()
  } else {
    reportHttpFailure({ status: res.status })
  }

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const parsed = z.object({ error: z.string().optional() }).safeParse(body)
    const message = parsed.success ? (parsed.data.error ?? res.statusText) : res.statusText
    throw new TypedFetchError(message, res.status, body)
  }

  return responseSchema.parse(body)
}
