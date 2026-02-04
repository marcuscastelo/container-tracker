import { z } from 'zod'

// Schema simples usado pela UI PoC (corresponde ao tipo Shipment do componente)
export const ShipmentSchema = z.object({
  process: z.string(),
  client: z.string(),
  carrier: z.string(),
  container: z.string(),
  route: z.string(),
  status: z.string(),
  eta: z.string(),
  statusClass: z.string().optional(),
})

export const ShipmentsSchema = z.array(ShipmentSchema)

export type Shipment = z.infer<typeof ShipmentSchema>
