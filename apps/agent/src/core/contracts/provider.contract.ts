import { AgentProviderSchema } from '@agent/core/types/provider'
import { z } from 'zod/v4'

export const ProviderInputSchema = z.object({
  syncRequestId: z.string().uuid(),
  provider: AgentProviderSchema,
  refType: z.literal('container'),
  ref: z.string().min(1),
})

export type ProviderInput = z.infer<typeof ProviderInputSchema>

export const ProviderRunResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('success'),
    observedAt: z.string().datetime({ offset: true }),
    raw: z.unknown(),
    parseError: z.string().min(1).nullable(),
  }),
  z.object({
    kind: z.literal('failed'),
    errorMessage: z.string().min(1),
  }),
])

export type ProviderRunResult = z.infer<typeof ProviderRunResultSchema>
