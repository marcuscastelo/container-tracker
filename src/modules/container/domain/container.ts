import z from 'zod/v4'

export const ContainerSchema = z.object({
  number: z.string().min(1, 'Container number is required'),
  shipmentId: z.string().min(1, 'Shipment ID is required'),
  carrier: z.string().nullable().optional(),
})

export type Container = z.infer<typeof ContainerSchema>
