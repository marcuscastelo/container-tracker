import z from 'zod/v4'

// Source of the process data
export const ProcessSourceSchema = z.enum(['manual', 'api', 'import'])

// Carrier enum (extensible)
export const CarrierSchema = z.enum([
  'maersk',
  'msc',
  'cmacgm',
  'hapag',
  'one',
  'evergreen',
  'unknown',
])
export type Carrier = z.infer<typeof CarrierSchema>
// Location for planned route (intentional, not observed)
export const PlannedLocation = z.object({
  display_name: z.string().nullable().optional(), // Free text like "Santos" or "BRSSZ"
  unlocode: z.string().nullable().optional(), // UN/LOCODE when known
  city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
})
export type PlannedLocation = z.infer<typeof PlannedLocation>
