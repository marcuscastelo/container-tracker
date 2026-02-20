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
  snapshotId: z.string().optional(),
})

const RefreshRedirectResponseSchema = z.object({
  redirect: z.string(),
})

const RefreshErrorResponseSchema = z.object({
  error: z.string(),
})

const RefreshHealthResponseSchema = z.object({
  ok: z.literal(true),
})

const RefreshResponseSchema = z.union([RefreshSuccessResponseSchema, RefreshRedirectResponseSchema])

const MaerskRequestParamsSchema = z.object({
  container: z.string(),
})

const MaerskRequestQuerySchema = z.object({
  headless: z.string().optional(),
  userDataDir: z.string().optional(),
  hold: z.string().optional(),
  timeout: z.string().optional(),
})

const MaerskSuccessResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  status: z.number().optional(),
  savedToSupabase: z.boolean().optional(),
})

const MaerskErrorResponseSchema = z.object({
  error: z.string(),
  hint: z.string().optional(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
  details: z.string().optional(),
  status: z.number().optional(),
  expectedUrl: z.string().optional(),
})

export const RefreshSchemas = {
  refreshRequest: RefreshRequestSchema,
  response: RefreshResponseSchema,
  responses: {
    error: RefreshErrorResponseSchema,
    health: RefreshHealthResponseSchema,
    success: RefreshSuccessResponseSchema,
    redirect: RefreshRedirectResponseSchema,
  },
  maersk: {
    params: MaerskRequestParamsSchema,
    query: MaerskRequestQuerySchema,
    responses: {
      success: MaerskSuccessResponseSchema,
      error: MaerskErrorResponseSchema,
    },
  },
  provider: ProviderSchema,
}
