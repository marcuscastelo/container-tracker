import z from 'zod/v4'
import { ProviderSchema } from '~/modules/tracking/domain/provider'

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
