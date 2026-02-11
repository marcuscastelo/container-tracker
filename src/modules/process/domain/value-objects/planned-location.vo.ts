import z from 'zod/v4'
import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

// Location for planned route (intentional, not observed)
const PlannedLocationSchema = z.object({
  display_name: z.string().nullable().optional(), // Free text like "Santos" or "BRSSZ"
  unlocode: z.string().nullable().optional(), // UN/LOCODE when known
  city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
})
type PlannedLocationProps = z.infer<typeof PlannedLocationSchema>

export type PlannedLocation = ProcessBrand<PlannedLocationProps, 'PlannedLocation'>

export function toPlannedLocation(location: unknown): PlannedLocation {
  const parsed = PlannedLocationSchema.safeParse(location)
  if (!parsed.success) {
    throw new Error(
      `Invalid PlannedLocation: ${parsed.error.message}, received: ${JSON.stringify(location)}`,
    )
  }
  return toProcessBrand<PlannedLocationProps, 'PlannedLocation'>(parsed.data)
}
