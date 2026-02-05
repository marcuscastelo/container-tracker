import type { z } from 'zod'

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
): Response {
  if (schema) schema.parse(data)
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
