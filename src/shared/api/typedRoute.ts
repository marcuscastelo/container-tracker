import type { z } from 'zod'
import { recordReadResponseMetrics } from '~/shared/observability/readRequestMetrics'

export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  const json = await req.json().catch(() => ({}))
  return schema.parse(json)
}

export function jsonResponse<T extends z.ZodTypeAny>(
  data: z.infer<T>,
  status = 200,
  schema?: T,
  headers?: HeadersInit,
): Response {
  if (schema) schema.parse(data)
  const serialized = JSON.stringify(data)
  recordReadResponseMetrics(serialized, status)
  const responseHeaders = new Headers(headers ?? undefined)
  responseHeaders.set('Content-Type', 'application/json')
  return new Response(serialized, {
    status,
    headers: responseHeaders,
  })
}
