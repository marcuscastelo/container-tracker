import z from 'zod/v4'

export const ProcessRefreshRequestSchema = z
  .object({
    mode: z.enum(['process', 'container']),
    container_number: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'container' && !value.container_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['container_number'],
        message: 'container_number is required when mode=container',
      })
    }
  })

export const ProcessCarrierDetectionRequestSchema = z.object({
  container_number: z.string().min(1).optional(),
})

export const SyncContainerResponseSchema = z.object({
  ok: z.literal(true),
  containerNumber: z.string(),
  syncedContainers: z.number().int().nonnegative(),
})

export const DetectProcessCarrierResponseSchema = z.object({
  detected: z.boolean(),
  carrier: z.string().nullable(),
})
