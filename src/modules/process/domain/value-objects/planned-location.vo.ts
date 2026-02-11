import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

export type PlannedLocation = ProcessBrand<unknown, 'PlannedLocation'>

export function toPlannedLocation(location: unknown): PlannedLocation {
  return toProcessBrand<unknown, 'PlannedLocation'>(location)
}
