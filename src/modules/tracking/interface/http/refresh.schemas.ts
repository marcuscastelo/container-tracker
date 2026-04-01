import z from 'zod/v4'

/**
 * Provider Zod schema for HTTP-boundary validation.
 * This is the interface layer's own schema — domain types are plain.
 */
const ProviderSchema = z.enum(['msc', 'maersk', 'cmacgm', 'pil'])

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

const RefreshStatusSchema = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED', 'NOT_FOUND'])

const RefreshStatusQuerySchema = z.object({
  sync_request_id: z.array(z.string().uuid()).min(1).max(100),
})

const RefreshStatusItemSchema = z.object({
  syncRequestId: z.string().uuid(),
  status: RefreshStatusSchema,
  lastError: z.string().nullable(),
  updatedAt: z.string().nullable(),
  refValue: z.string().nullable(),
})

const RefreshStatusResponseSchema = z.object({
  ok: z.literal(true),
  allTerminal: z.boolean(),
  requests: z.array(RefreshStatusItemSchema),
})

export const RefreshSchemas = {
  refreshRequest: RefreshRequestSchema,
  refreshStatusQuery: RefreshStatusQuerySchema,
  response: RefreshResponseSchema,
  responses: {
    error: RefreshErrorResponseSchema,
    health: RefreshHealthResponseSchema,
    success: RefreshSuccessResponseSchema,
    status: RefreshStatusResponseSchema,
  },
  provider: ProviderSchema,
  status: RefreshStatusSchema,
}
