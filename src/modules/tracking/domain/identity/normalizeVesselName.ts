export function normalizeVesselName(vesselName: string | null | undefined): string | null {
  const normalized = vesselName?.trim().toUpperCase() ?? ''
  return normalized.length > 0 ? normalized : null
}
