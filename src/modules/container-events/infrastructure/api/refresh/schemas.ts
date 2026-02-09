import z4 from 'zod/v4'

// Request Schemas
const RefreshRequestSchema = z4
  .object({ container: z4.string(), carrier: z4.string().optional().nullable() })
  .strict()

export type RefreshRequest = z4.infer<typeof RefreshRequestSchema>

// Response Schemas
const RefreshSuccessResponseSchema = z4.object({ ok: z4.literal(true), container: z4.string() })
const RefreshRedirectResponseSchema = z4.object({ redirect: z4.string() })
const RefreshResponseSchema = z4.union([
  RefreshSuccessResponseSchema,
  RefreshRedirectResponseSchema,
])

export type RefreshResponse = z4.infer<typeof RefreshResponseSchema>
const RefreshErrorResponseSchema = z4.object({ error: z4.string() })
export type RefreshErrorResponse = z4.infer<typeof RefreshErrorResponseSchema>

// Health Schemas
const RefreshHealthResponseSchema = z4.object({ ok: z4.literal(true) })
export type RefreshHealthResponse = z4.infer<typeof RefreshHealthResponseSchema>

// Internal exports for composition/testing
export const RefreshSchemas = {
  request: RefreshRequestSchema,
  response: RefreshResponseSchema,
  responses: {
    error: RefreshErrorResponseSchema,
    health: RefreshHealthResponseSchema,
    success: RefreshSuccessResponseSchema,
    redirect: RefreshRedirectResponseSchema,
  },
}
