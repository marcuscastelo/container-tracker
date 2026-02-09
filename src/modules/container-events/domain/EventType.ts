import z from 'zod/v4'

export const EventTypeSchema = z.enum([
  'INVALID',
  'GATE_OUT',
  'GATE_IN',
  'LOAD',
  'DEPARTURE',
  'ARRIVAL',
])

export type EventType = z.infer<typeof EventTypeSchema>
