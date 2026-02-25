import z from 'zod/v4'

/**
 * Provider Zod schema for HTTP-boundary validation.
 * This is the interface layer's own schema — domain types are plain.
 */
const ProviderSchema = z.enum(['msc', 'maersk', 'cmacgm'])

const RefreshRequestSchema = z
  .object({
    container: z.string(),
    carrier: ProviderSchema,
  })
  .strict()

const RefreshSuccessResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  syncRequestId: z.string().uuid(),
  queued: z.literal(true),
  deduped: z.boolean(),
})

const RefreshErrorResponseSchema = z.object({
  error: z.string(),
})

const RefreshHealthResponseSchema = z.object({
  ok: z.literal(true),
})

const RefreshResponseSchema = RefreshSuccessResponseSchema

export const RefreshSchemas = {
  refreshRequest: RefreshRequestSchema,
  response: RefreshResponseSchema,
  responses: {
    error: RefreshErrorResponseSchema,
    health: RefreshHealthResponseSchema,
    success: RefreshSuccessResponseSchema,
  },
  provider: ProviderSchema,
}
