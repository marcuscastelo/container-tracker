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
