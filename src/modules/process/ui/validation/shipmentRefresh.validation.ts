import { z } from 'zod/v4'

export const RefreshPostResponseSchema = z.object({
  ok: z.literal(true),
  container: z.string(),
  syncRequestId: z.string().uuid(),
  queued: z.literal(true),
  deduped: z.boolean(),
})

export const RefreshStatusResponseSchema = z.object({
  ok: z.literal(true),
  allTerminal: z.boolean(),
  requests: z.array(
    z.object({
      syncRequestId: z.string().uuid(),
      status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED', 'NOT_FOUND']),
      lastError: z.string().nullable(),
      updatedAt: z.string().nullable(),
      refValue: z.string().nullable(),
    }),
  ),
})

export type RefreshStatusRequest = {
  readonly syncRequestId: string
  readonly status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

export type RefreshStatusResponse = {
  readonly ok: true
  readonly allTerminal: boolean
  readonly requests: readonly RefreshStatusRequest[]
}
