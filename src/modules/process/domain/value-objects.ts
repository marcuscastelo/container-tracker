import z from 'zod/v4'

// Operation type enum - explicit choice, defaults to 'unknown'
export const OperationType = z.enum(['import', 'export', 'transshipment', 'unknown'])
export type OperationType = z.infer<typeof OperationType>

// Source of the process data
export const ProcessSource = z.enum(['manual', 'api', 'import'])
export type ProcessSource = z.infer<typeof ProcessSource>

// Carrier enum (extensible)
export const Carrier = z.enum(['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'])
export type Carrier = z.infer<typeof Carrier>
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
