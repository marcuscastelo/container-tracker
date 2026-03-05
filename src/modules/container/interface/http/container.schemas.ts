import z from 'zod/v4'

export const CheckContainersBodySchema = z.object({
  containers: z.array(z.string()).nonempty(),
})

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
