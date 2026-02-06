import z from 'zod/v4'

// Operation type enum - explicit choice, defaults to 'unknown'
export const OperationTypeSchema = z.enum(['import', 'export', 'transshipment', 'unknown'])
export type OperationType = z.infer<typeof OperationTypeSchema>

// Source of the process data
export const ProcessSourceSchema = z.enum(['manual', 'api', 'import'])
export type ProcessSource = z.infer<typeof ProcessSourceSchema>

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

// Container initial status - explicit choice
export const ContainerInitialStatus = z.enum(['unknown', 'booked'])
export type ContainerInitialStatus = z.infer<typeof ContainerInitialStatus>
