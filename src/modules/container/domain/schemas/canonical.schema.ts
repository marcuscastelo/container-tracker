import { z } from 'zod'

// DateLike helper (accept ISO string, number ms, or Date)
const DateLike = z.preprocess((arg: unknown) => {
  if (arg == null || arg === '') return null
  if (typeof arg === 'string') {
    const msMatch = arg.match(/\/Date\(([-0-9]+)\)\//)
    if (msMatch) {
      const ms = Number(msMatch[1])
      if (!Number.isNaN(ms)) return new Date(ms)
    }
    const d = new Date(arg)
    if (!Number.isNaN(d.getTime())) return d
    return null
  }
  if (typeof arg === 'number') {
    const d = new Date(arg)
    if (!Number.isNaN(d.getTime())) return d
    return null
  }
  if (arg instanceof Date) return arg
  return null
}, z.date().nullable())

export const LocationSchema = z.object({
  terminal: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const FlagsSchema = z.object({
  missing_eta: z.boolean().optional(),
  stale_data: z.boolean().optional(),
})

// Event enums (align with master)
export const EventActivity = z.enum([
  'GATE_IN',
  'GATE_OUT',
  'LOAD',
  'DISCHARGE',
  'DEPARTURE',
  'ARRIVAL',
  'CUSTOMS_HOLD',
  'CUSTOMS_RELEASE',
  'DELIVERY',
  'EMPTY_RETURN',
  'OTHER',
])
export type EventActivity = z.infer<typeof EventActivity>

export const EventTimeType = z.enum(['ACTUAL', 'EXPECTED'])
export type EventTimeType = z.infer<typeof EventTimeType>

export const EventSchema = z.object({
  id: z.string().optional(),
  activity: EventActivity.optional(),
  event_time: DateLike.optional(),
  event_time_type: EventTimeType.optional(),
  location: LocationSchema.optional(),
  vessel: z
    .object({
      vessel_name: z.string().nullable().optional(),
      voyage_num: z.string().nullable().optional(),
    })
    .optional(),
  sourceEvent: z.any().optional(),
})

// Container status enum aligned with master list (common subset)
export const ContainerStatusEnum = z.enum([
  'UNKNOWN',
  'AWAITING_DATA',
  'BOOKED',
  'GATE_IN',
  'LOADED_ON_VESSEL',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'CUSTOMS_HOLD',
  'CUSTOMS_RELEASED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
  'CANCELLED',
])

// Container shape used by F1.1 canonical contract
export const F1ContainerSchema = z.object({
  id: z.string(),
  container_number: z.string().regex(/^[A-Z]{4}\d{7}$/, 'invalid ISO 6346 container number'),
  shipment_id: z.string(),
  // status uses canonical enum when available
  status: ContainerStatusEnum.nullable().optional(),
  eta: DateLike.optional(),
  flags: FlagsSchema.optional(),
  // optional list of events belonging to the container
  events: z.array(EventSchema).optional(),
  // basic type/code fields
  iso_code: z.string().nullable().optional(),
  container_type: z.string().nullable().optional(),
  source: z.union([
    z.literal('manual'),
    z.object({
      type: z.literal('api'),
      api: z.string().optional(),
      fetched_at: DateLike.optional(),
      raw: z.any().optional(),
    }),
  ]),
  created_at: DateLike,
  raw: z.any().optional(),
})

export const F1ShipmentSchema = z.object({
  id: z.string(),
  origin: LocationSchema.optional(),
  destination: LocationSchema.optional(),
  carrier: z.string(),
  created_at: DateLike,
  source: z.union([
    z.literal('manual'),
    z.object({
      type: z.literal('api'),
      api: z.string().optional(),
      fetched_at: DateLike.optional(),
      raw: z.any().optional(),
    }),
  ]),
  containers: z.array(F1ContainerSchema).min(1),
  raw: z.any().optional(),
})

export type F1Container = z.infer<typeof F1ContainerSchema>
export type F1Shipment = z.infer<typeof F1ShipmentSchema>
