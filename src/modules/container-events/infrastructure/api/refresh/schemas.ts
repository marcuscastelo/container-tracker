import { z } from 'zod/v4'

export const RefreshRequestSchema = z
  .object({
    container: z.string(),
    carrier: z.string().optional().nullable(),
  })
  .strict()

export const RefreshSuccessResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
})
export const RefreshRedirectResponseSchema = z.object({ redirect: z.string() })

export const RefreshResponseSchema = z.union([
  RefreshSuccessResponseSchema,
  RefreshRedirectResponseSchema,
])

export const RefreshErrorResponseSchema = z.object({ error: z.string() })

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type RefreshErrorResponse = z.infer<typeof RefreshErrorResponseSchema>

// Health response schema for GET
export const RefreshHealthResponseSchema = z.object({ ok: z.literal(true) })
export type RefreshHealthResponse = z.infer<typeof RefreshHealthResponseSchema>
