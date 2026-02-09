import z from 'zod/v4'

/**
 * Request/Response schemas for the tracking refresh API.
 *
 * These replace the old RefreshSchemas from the container-events module.
 */

export const RefreshRequestSchema = z
  .object({
    container: z.string(),
    carrier: z.string().optional().nullable(),
  })
  .strict()

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>

export const RefreshSuccessResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  snapshotId: z.string().optional(),
})

export const RefreshRedirectResponseSchema = z.object({
  redirect: z.string(),
})

export const RefreshErrorResponseSchema = z.object({
  error: z.string(),
})

export const RefreshHealthResponseSchema = z.object({
  ok: z.literal(true),
})

export const RefreshResponseSchema = z.union([
  RefreshSuccessResponseSchema,
  RefreshRedirectResponseSchema,
])

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type RefreshErrorResponse = z.infer<typeof RefreshErrorResponseSchema>
export type RefreshHealthResponse = z.infer<typeof RefreshHealthResponseSchema>

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
