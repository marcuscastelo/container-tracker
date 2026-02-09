import z from 'zod/v4'
import { EventActualitySchema } from '~/modules/container-events/domain/EventAcuality'
import { EventSourceSchema } from '~/modules/container-events/domain/EventSource'
import { EventTypeSchema } from '~/modules/container-events/domain/EventType'

export const ContainerSchemaEvent = z.object({
  id: z.string(),
  container_number: z.string(),
  event_time: z.string(), // ISO string
  type: EventTypeSchema,
  source: EventSourceSchema,
  actuality: EventActualitySchema,
})

export type ContainerEvent = z.infer<typeof ContainerSchemaEvent>

/*
Example: 
{
  id: '12345',
  container_number: 'ABC1234567',
  event_time: '2024-01-01T12:00:00Z',
  type: 'GATE_IN',
  source: {
    carrier_name: 'CarrierX',
    raw: { ... } // original payload from CarrierX
  },
}
*/
