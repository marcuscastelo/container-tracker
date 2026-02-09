import { z } from 'zod'

/*
  Zod schema for Maersk tracking API (based on examples/maersk.json)
  - Models the subset of fields we use for timeline, alerts and list view.
  - Keep it permissive: many fields are optional and unknown fields are kept in `raw`.
  - Documented enum-like values and notes for mapping.
*/

// Top-level origin/destination location
export const MaerskLocationSchema = z.object({
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  geo_site: z.string().nullable().optional(),
  terminal: z.string().nullable().optional(),
  site_type: z.string().nullable().optional(),
  geoid_city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  location_code: z.string().nullable().optional(),
  raw: z.any().optional(),
})

// Event object inside a container.location.events
export const MaerskEventSchema = z.object({
  type: z.string().nullable().optional(), // often "EQUIPMENT"
  actfor: z.string().nullable().optional(), // e.g. "EXP"
  eventId: z.string().nullable().optional(),
  stempty: z.boolean().nullable().optional(),
  activity: z.string().nullable().optional(), // semantically: GATE-IN, GATE-OUT, LOAD, CONTAINER ARRIVAL, etc.
  event_time: z.string().nullable().optional(), // ISO timestamp string
  locationCode: z.string().nullable().optional(),
  transport_mode: z.string().nullable().optional(), // MVS (vessel), TRK, RIL etc.
  event_time_type: z.string().nullable().optional(), // ACTUAL | EXPECTED
  vessel_num: z.string().nullable().optional(),
  voyage_num: z.string().nullable().optional(),
  vessel_name: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const MaerskLocationWithEventsSchema = MaerskLocationSchema.extend({
  events: z.array(MaerskEventSchema).optional(),
})

export const MaerskContainerSchema = z.object({
  status: z.string().nullable().optional(), // e.g. IN_PROGRESS
  iso_code: z.string().nullable().optional(),
  operator: z.string().nullable().optional(), // carrier code like MAEU
  locations: z.array(MaerskLocationWithEventsSchema).optional(),
  container_num: z.string().nullable().optional(),
  container_size: z.string().nullable().optional(),
  container_type: z.string().nullable().optional(),
  last_update_time: z.string().nullable().optional(), // ISO
  eta_final_delivery: z.string().nullable().optional(), // ISO
  service_type_origin: z.string().nullable().optional(),
  service_type_destination: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const MaerskApiSchema = z.object({
  origin: MaerskLocationSchema.optional(),
  destination: MaerskLocationSchema.optional(),
  containers: z.array(MaerskContainerSchema).optional(),
  last_update_time: z.string().nullable().optional(),
  has_import_shipment: z.boolean().nullable().optional(),
  is_container_search: z.boolean().nullable().optional(),
  raw: z.any().optional(),
})

export type MaerskApi = z.infer<typeof MaerskApiSchema>
