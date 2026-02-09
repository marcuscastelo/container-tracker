import { z } from 'zod'

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
  const res = await fetch(input, init)
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    // try to extract structured error (may include additional fields like `existing`)
    try {
      const parsed = z.object({ error: z.string().optional() }).parse(body)
      throw new TypedFetchError(parsed.error ?? res.statusText, res.status, body)
    } catch {
      throw new TypedFetchError(res.statusText, res.status, body)
    }
  }

  return responseSchema.parse(body)
}
