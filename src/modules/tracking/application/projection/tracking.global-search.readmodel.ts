import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import {
  deriveTrackingOperationalSummary,
  type TrackingOperationalEtaState,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingSearchObservationProjection } from '~/modules/tracking/application/projection/tracking.search.readmodel'
import { deriveTransshipment } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import {
  compareObservationsChronologically,
  deriveTimeline,
} from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'

const ROUTE_TYPES = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE'] as const
const TERMINAL_TYPES = ['ARRIVAL', 'DISCHARGE', 'DELIVERY'] as const

type ContainerObservationGroup = {
  processId: string
  containerId: string
  containerNumber: string
  observations: Observation[]
}

export type TrackingGlobalSearchProjection = Readonly<{
  processId: string
  containerId: string
  containerNumber: string
  statusCode: ContainerStatus
  eta: TemporalValueDto | null
  etaState: TrackingOperationalEtaState | null
  etaType: string | null
  currentLocationCode: string | null
  currentLocationDisplay: string | null
  currentVesselName: string | null
  currentVoyage: string | null
  currentVesselVisible: boolean
  routeOriginCode: string | null
  routeOriginDisplay: string | null
  routeDestinationCode: string | null
  routeDestinationDisplay: string | null
  routeDisplays: readonly string[]
  routeCountryTokens: readonly string[]
  terminalLocationLabels: readonly string[]
}>

type DeriveTrackingGlobalSearchProjectionsArgs = Readonly<{
  observations: readonly TrackingSearchObservationProjection[]
  now: Instant
}>

function normalizeCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeDisplay(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeCountryToken(value: string): string | null {
  const normalized = value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function extractCountryTokens(display: string | null): readonly string[] {
  if (display === null) return []

  const parts = display
    .split(/[,-/]/)
    .map((part) => normalizeCountryToken(part))
    .filter((part): part is string => part !== null)

  if (parts.length === 0) {
    const normalized = normalizeCountryToken(display)
    return normalized === null ? [] : [normalized]
  }

  const lastPart = parts[parts.length - 1]
  return lastPart === undefined ? parts : Array.from(new Set([lastPart, ...parts]))
}

function groupByContainer(
  observations: readonly TrackingSearchObservationProjection[],
): ReadonlyMap<string, ContainerObservationGroup> {
  const grouped = new Map<string, ContainerObservationGroup>()

  for (const item of observations) {
    const existing = grouped.get(item.observation.container_id)
    if (existing !== undefined) {
      existing.observations.push(item.observation)
      continue
    }

    grouped.set(item.observation.container_id, {
      processId: item.processId,
      containerId: item.observation.container_id,
      containerNumber: item.observation.container_number,
      observations: [item.observation],
    })
  }

  return grouped
}

function deriveOrderedRouteObservations(observations: readonly Observation[]): readonly {
  readonly code: string
  readonly display: string | null
}[] {
  const ordered = [...observations].sort(compareObservationsChronologically)
  const route = new Map<string, string | null>()

  for (const observation of ordered) {
    const isRouteType = ROUTE_TYPES.some((type) => type === observation.type)
    if (!isRouteType) continue

    const code = normalizeCode(observation.location_code)
    if (code === null || route.has(code)) continue

    route.set(code, normalizeDisplay(observation.location_display))
  }

  return Array.from(route.entries()).map(([code, display]) => ({ code, display }))
}

function deriveTerminalLocationLabels(observations: readonly Observation[]): readonly string[] {
  const ordered = [...observations].sort(compareObservationsChronologically)
  const labels = new Map<string, string>()

  for (const observation of ordered) {
    const isTerminalType = TERMINAL_TYPES.some((type) => type === observation.type)
    if (!isTerminalType) continue

    const display = normalizeDisplay(observation.location_display)
    if (display === null) continue

    const normalizedKey = display
      .normalize('NFD')
      .replaceAll(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase()

    if (!labels.has(normalizedKey)) {
      labels.set(normalizedKey, display)
    }
  }

  return Array.from(labels.values())
}

export function deriveTrackingGlobalSearchProjections(
  args: DeriveTrackingGlobalSearchProjectionsArgs,
): readonly TrackingGlobalSearchProjection[] {
  const grouped = groupByContainer(args.observations)
  const projections: TrackingGlobalSearchProjection[] = []

  for (const group of grouped.values()) {
    const projectionObservations = suppressSupersededObservationsForProjection(group.observations)
    const timeline = deriveTimeline(
      group.containerId,
      group.containerNumber,
      projectionObservations,
      args.now,
    )
    const statusCode = deriveStatus(timeline)
    const transshipment = deriveTransshipment(timeline)
    const operational = deriveTrackingOperationalSummary({
      observations: toTrackingObservationProjections(projectionObservations),
      status: statusCode,
      transshipment,
      now: args.now,
    })
    const route = deriveOrderedRouteObservations(projectionObservations)
    const routeOrigin = route[0] ?? null
    const routeDestination = route.length > 1 ? (route[route.length - 1] ?? null) : null

    projections.push({
      processId: group.processId,
      containerId: group.containerId,
      containerNumber: group.containerNumber,
      statusCode,
      eta: operational.eta?.eventTime ?? null,
      etaState: operational.eta?.state ?? null,
      etaType: normalizeText(operational.eta?.type ?? null),
      currentLocationCode: normalizeCode(operational.currentContext.locationCode),
      currentLocationDisplay: normalizeDisplay(operational.currentContext.locationDisplay),
      currentVesselName: normalizeText(
        operational.currentContext.vesselVisible ? operational.currentContext.vesselName : null,
      ),
      currentVoyage: normalizeText(
        operational.currentContext.vesselVisible ? operational.currentContext.voyage : null,
      ),
      currentVesselVisible: operational.currentContext.vesselVisible,
      routeOriginCode: routeOrigin?.code ?? null,
      routeOriginDisplay: routeOrigin?.display ?? null,
      routeDestinationCode: routeDestination?.code ?? null,
      routeDestinationDisplay: routeDestination?.display ?? null,
      routeDisplays: route
        .map((item) => item.display)
        .filter((display): display is string => display !== null),
      routeCountryTokens: Array.from(
        new Set(route.flatMap((item) => extractCountryTokens(item.display))),
      ),
      terminalLocationLabels: deriveTerminalLocationLabels(projectionObservations),
    })
  }

  return projections
}
