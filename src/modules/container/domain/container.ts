import z from 'zod/v4'

export const ContainerSchema = z.object({
  id: z.uuid(),
  container_number: z.string().min(1, 'Container number is required'),
  process_id: z.string().min(1, 'Process ID is required'),
  carrier_code: z.string(),
})

export const NewContainerSchema = ContainerSchema.omit({ id: true })

export type Container = z.infer<typeof ContainerSchema>
export type NewContainer = z.infer<typeof NewContainerSchema>
