import z from 'zod/v4'

export const CheckContainersBodySchema = z.object({
  containers: z.array(z.string()).nonempty(),
})

export type CheckContainersBody = z.infer<typeof CheckContainersBodySchema>

const ContainerConflictSchema = z.object({
  containerNumber: z.string(),
  processId: z.string(),
  containerId: z.string(),
  link: z.string(),
  message: z.string(),
})

export const CheckContainersResponseSchema = z.object({
  conflicts: z.array(ContainerConflictSchema),
})

export type CheckContainersResponse = z.infer<typeof CheckContainersResponseSchema>
