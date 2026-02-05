import { z } from 'zod'

export async function typedFetch<T extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  responseSchema: T,
): Promise<z.infer<T>> {
  const res = await fetch(input, init)
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    // try to extract structured error
    try {
      const parsed = z.object({ error: z.string().optional() }).parse(body)
      throw new Error(parsed.error ?? res.statusText)
    } catch {
      throw new Error(res.statusText)
    }
  }

  return responseSchema.parse(body)
}
