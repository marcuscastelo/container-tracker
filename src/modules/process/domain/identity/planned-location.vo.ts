import { type ProcessBrand, toProcessBrand } from '~/modules/process/domain/process.types'

/**
 * Props for a planned location (intentional, not observed).
 */
type PlannedLocationProps = {
  display_name?: string | null
  unlocode?: string | null
  city?: string | null
  country_code?: string | null
}

export type PlannedLocation = ProcessBrand<PlannedLocationProps, 'PlannedLocation'>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function toPlannedLocation(location: unknown): PlannedLocation {
  if (!isRecord(location)) {
    throw new Error(
      `Invalid PlannedLocation: expected object, received: ${JSON.stringify(location)}`,
    )
  }
  const props: PlannedLocationProps = {
    display_name: optionalString(location.display_name),
    unlocode: optionalString(location.unlocode),
    city: optionalString(location.city),
    country_code: optionalString(location.country_code),
  }
  return toProcessBrand<PlannedLocationProps, 'PlannedLocation'>(props)
}
