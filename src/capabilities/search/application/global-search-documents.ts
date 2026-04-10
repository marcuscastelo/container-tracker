import type { GlobalSearchDocument } from '~/capabilities/search/application/global-search.types'
import type { TrackingGlobalSearchProjection } from '~/modules/tracking/application/projection/tracking.global-search.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { toTrackingOperationalAlertCategory } from '~/modules/tracking/features/alerts/application/projection/tracking.operational-alert-category.readmodel'
import { compareTemporal } from '~/shared/time/compare-temporal'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValue } from '~/shared/time/parsing'

export type SearchProcessRecord = Readonly<{
  pwc: Readonly<{
    process: Readonly<{
      id: string
      reference: string | null
      origin: string | null
      destination: string | null
      carrier: string | null
      billOfLading: string | null
      importerName: string | null
      exporterName: string | null
      depositary: string | null
    }>
    containers: readonly Readonly<{
      containerNumber: string
    }>[]
  }>
  summary: Readonly<{
    process_status: string
    eta: TemporalValueDto | null
    tracking_validation: Readonly<{
      hasIssues: boolean
    }>
  }>
}>

type BuildGlobalSearchDocumentsCommand = Readonly<{
  processes: readonly SearchProcessRecord[]
  tracking: readonly TrackingGlobalSearchProjection[]
  alerts: readonly TrackingActiveAlertReadModel[]
}>

const TEMPORAL_COMPARE_OPTIONS = {
  timezone: 'UTC',
  strategy: 'start-of-day',
} as const

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function dedupeText(values: readonly (string | null | undefined)[]): readonly string[] {
  const byKey = new Map<string, string>()

  for (const value of values) {
    const normalizedValue = normalizeText(value)
    if (normalizedValue === null) continue

    const key = normalizeTextKey(normalizedValue)
    if (!byKey.has(key)) {
      byKey.set(key, normalizedValue)
    }
  }

  return Array.from(byKey.values())
}

function toResolvedValue(values: readonly string[]) {
  if (values.length === 0) {
    return {
      value: null,
      multiple: false,
    }
  }

  if (values.length === 1) {
    return {
      value: values[0] ?? null,
      multiple: false,
    }
  }

  return {
    value: null,
    multiple: true,
  }
}

function extractCountryTokens(values: readonly (string | null | undefined)[]): readonly string[] {
  const tokens: string[] = []

  for (const value of values) {
    const normalizedValue = normalizeText(value)
    if (normalizedValue === null) continue

    const parts = normalizedValue.split(/[,-/]/).map((part) => normalizeTextKey(part))
    for (const part of parts) {
      if (part.length > 0) {
        tokens.push(part)
      }
    }
  }

  return dedupeText(tokens)
}

function compareNullableTemporalValues(
  left: TemporalValueDto | null,
  right: TemporalValueDto | null,
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  const leftTemporal = parseTemporalValue(left)
  const rightTemporal = parseTemporalValue(right)
  if (leftTemporal !== null && rightTemporal !== null) {
    return compareTemporal(leftTemporal, rightTemporal, TEMPORAL_COMPARE_OPTIONS)
  }

  return JSON.stringify(left).localeCompare(JSON.stringify(right))
}

function isSameTemporalValue(
  left: TemporalValueDto | null,
  right: TemporalValueDto | null,
): boolean {
  return compareNullableTemporalValues(left, right) === 0
}

function buildRouteLabel(command: {
  readonly originLabel: string | null
  readonly destinationLabel: string | null
  readonly tracking: readonly TrackingGlobalSearchProjection[]
}): string | null {
  const originLabel =
    normalizeText(command.originLabel) ??
    normalizeText(command.tracking[0]?.routeOriginDisplay ?? null)
  const destinationLabel =
    normalizeText(command.destinationLabel) ??
    normalizeText(command.tracking[0]?.routeDestinationDisplay ?? null)

  if (originLabel !== null && destinationLabel !== null) {
    return `${originLabel} -> ${destinationLabel}`
  }

  return originLabel ?? destinationLabel
}

function selectEtaMetadata(command: {
  readonly processEta: TemporalValueDto | null
  readonly tracking: readonly TrackingGlobalSearchProjection[]
}): {
  readonly etaStates: readonly string[]
  readonly etaTypes: readonly string[]
} {
  if (command.processEta === null) {
    return {
      etaStates: [],
      etaTypes: [],
    }
  }

  const matchingTracking = command.tracking.filter((projection) =>
    isSameTemporalValue(projection.eta, command.processEta),
  )
  const candidates = matchingTracking.length > 0 ? matchingTracking : command.tracking

  return {
    etaStates: dedupeText(candidates.map((projection) => projection.etaState)),
    etaTypes: dedupeText(candidates.map((projection) => projection.etaType)),
  }
}

export function buildGlobalSearchDocuments(
  command: BuildGlobalSearchDocumentsCommand,
): readonly GlobalSearchDocument[] {
  const trackingByProcessId = new Map<string, TrackingGlobalSearchProjection[]>()
  for (const projection of command.tracking) {
    const existing = trackingByProcessId.get(projection.processId)
    if (existing === undefined) {
      trackingByProcessId.set(projection.processId, [projection])
      continue
    }

    existing.push(projection)
  }

  const alertCategoriesByProcessId = new Map<
    string,
    Set<GlobalSearchDocument['activeAlertCategories'][number]>
  >()
  for (const alert of command.alerts) {
    const existing = alertCategoriesByProcessId.get(alert.process_id)
    const category = toTrackingOperationalAlertCategory(alert.type)

    if (existing === undefined) {
      alertCategoriesByProcessId.set(alert.process_id, new Set([category]))
      continue
    }

    existing.add(category)
  }

  return command.processes.map((entry) => {
    const process = entry.pwc.process
    const tracking = trackingByProcessId.get(process.id) ?? []
    const containerNumbers = dedupeText(
      entry.pwc.containers.map((container) => container.containerNumber),
    )
    const currentLocations = dedupeText(
      tracking.map((projection) => projection.currentLocationDisplay),
    )
    const currentVessels = dedupeText(tracking.map((projection) => projection.currentVesselName))
    const currentVoyages = dedupeText(tracking.map((projection) => projection.currentVoyage))
    const terminalLabels = dedupeText(
      tracking.flatMap((projection) => projection.terminalLocationLabels),
    )
    const etaMetadata = selectEtaMetadata({
      processEta: entry.summary.eta,
      tracking,
    })

    return {
      processId: process.id,
      processReference: normalizeText(process.reference),
      billOfLading: normalizeText(process.billOfLading),
      importerName: normalizeText(process.importerName),
      exporterName: normalizeText(process.exporterName),
      carrierName: normalizeText(process.carrier),
      statusCode: normalizeText(entry.summary.process_status),
      eta: entry.summary.eta,
      etaStates: etaMetadata.etaStates,
      etaTypes: etaMetadata.etaTypes,
      originLabel: normalizeText(process.origin),
      originCountryTokens: extractCountryTokens([
        process.origin,
        tracking[0]?.routeOriginDisplay ?? null,
      ]),
      destinationLabel: normalizeText(process.destination),
      destinationCountryTokens: extractCountryTokens([
        process.destination,
        tracking[0]?.routeDestinationDisplay ?? null,
      ]),
      depotLabel: normalizeText(process.depositary),
      routeLabel: buildRouteLabel({
        originLabel: process.origin,
        destinationLabel: process.destination,
        tracking,
      }),
      routeDisplays: dedupeText(tracking.flatMap((projection) => projection.routeDisplays)),
      containerNumbers,
      terminalLabels,
      terminalDisplay: toResolvedValue(terminalLabels),
      currentLocations,
      currentLocationDisplay: toResolvedValue(currentLocations),
      currentVessels,
      currentVesselDisplay: toResolvedValue(currentVessels),
      currentVoyages,
      currentVoyageDisplay: toResolvedValue(currentVoyages),
      hasValidationRequired: entry.summary.tracking_validation.hasIssues,
      activeAlertCategories: Array.from(alertCategoriesByProcessId.get(process.id) ?? []),
    }
  })
}
