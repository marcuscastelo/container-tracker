import z from 'zod/v4'

const ProcessIdsQueryValueSchema = z.string().transform((value, ctx) => {
  const processIds = Array.from(
    new Set(
      value
        .split(',')
        .map((processId) => processId.trim())
        .filter((processId) => processId.length > 0),
    ),
  )

  if (processIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'processIds must include at least one process id',
    })
    return z.NEVER
  }

  return processIds
})

export const ProcessesSyncStatusQuerySchema = z.object({
  processIds: ProcessIdsQueryValueSchema.optional(),
})

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

export const SyncContainerResponseSchema = z.object({
  ok: z.literal(true),
  containerNumber: z.string(),
  syncedContainers: z.number().int().nonnegative(),
})
