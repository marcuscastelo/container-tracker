import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { isTrackingTemporalValueExpired } from '~/modules/tracking/domain/temporal/tracking-temporal'
import { classifySeries } from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TemporalValueDto } from '~/shared/time/dto'
import { toTemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

type TrackingOperationalEtaState = 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED'
export type TrackingLifecycleBucket = 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery'

export type TrackingOperationalEta = {
  readonly eventTime: TemporalValueDto
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly state: TrackingOperationalEtaState
  readonly type: string
  readonly locationCode: string | null
  readonly locationDisplay: string | null
}

type TrackingOperationalTransshipmentPort = {
  readonly code: string
  readonly display: string | null
}

export type TrackingOperationalTransshipment = {
  readonly hasTransshipment: boolean
  readonly count: number
  readonly ports: readonly TrackingOperationalTransshipmentPort[]
}

export type TrackingObservationForOperationalSummary = {
  readonly id: string
  readonly type: string
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly created_at: string
}

export type TrackingOperationalSummary = {
  readonly status: string
  readonly eta: TrackingOperationalEta | null
  readonly etaApplicable?: boolean
  readonly lifecycleBucket?: TrackingLifecycleBucket
  readonly transshipment: TrackingOperationalTransshipment
  readonly dataIssue: boolean
}

type DeriveTrackingOperationalSummaryArgs = {
  readonly observations: readonly TrackingObservationForOperationalSummary[]
  readonly status: string
  readonly transshipment: TransshipmentInfo
  readonly podLocationCode?: string | null
  readonly now: Instant
  readonly dataIssue?: boolean
}

const ROUTE_TYPES = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE'] as const

function normalizeLocationCode(code: string | null | undefined): string | null {
  if (code === null) return null
  if (code === undefined) return null
  const normalized = code.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeLocationDisplay(display: string | null): string | null {
  if (display === null) return null
  const normalized = display.trim()
  return normalized.length > 0 ? normalized : null
}

function latestObservation(
  observations: readonly TrackingObservationForOperationalSummary[],
): TrackingObservationForOperationalSummary | null {
  if (observations.length === 0) return null

  const sorted = [...observations].sort(compareObservationsChronologically)
  return sorted[sorted.length - 1] ?? null
}

function derivePrimarySeriesObservations(
  observations: readonly TrackingObservationForOperationalSummary[],
  now: Instant,
): readonly TrackingObservationForOperationalSummary[] {
  const groups = new Map<string, TrackingObservationForOperationalSummary[]>()

  for (const observation of observations) {
    const key = buildSeriesKey(observation)
    const series = groups.get(key)
    if (series) {
      series.push(observation)
    } else {
      groups.set(key, [observation])
    }
  }

  const primaries: TrackingObservationForOperationalSummary[] = []

  for (const series of groups.values()) {
    series.sort(compareObservationsChronologically)
    const classification = classifySeries(series, now)
    if (classification.primary) {
      primaries.push(classification.primary)
      continue
    }

    // For operational ETA visibility we keep expired EXPECTED as fallback
    // when a series has no ACTUAL (safe-first still picks latest EXPECTED).
    const latestExpected = [...series]
      .reverse()
      .find((observation) => observation.event_time_type === 'EXPECTED')

    if (latestExpected) {
      primaries.push(latestExpected)
    }
  }

  return primaries
}

function toEtaState(
  observation: TrackingObservationForOperationalSummary,
  now: Instant,
): TrackingOperationalEtaState | null {
  if (observation.event_time_type === 'ACTUAL') return 'ACTUAL'
  if (observation.event_time === null) return null
  if (isTrackingTemporalValueExpired(observation.event_time, now)) return 'EXPIRED_EXPECTED'
  return 'ACTIVE_EXPECTED'
}

function toTrackingOperationalEta(
  observation: TrackingObservationForOperationalSummary,
  now: Instant,
): TrackingOperationalEta | null {
  const state = toEtaState(observation, now)
  if (state === null || observation.event_time === null) return null

  return {
    eventTime: toTemporalValueDto(observation.event_time),
    eventTimeType: observation.event_time_type,
    state,
    type: observation.type,
    locationCode: normalizeLocationCode(observation.location_code),
    locationDisplay: normalizeLocationDisplay(observation.location_display),
  }
}

function deriveEtaFromSeries(
  observations: readonly TrackingObservationForOperationalSummary[],
  podLocationCode: string | null | undefined,
  now: Instant,
): TrackingOperationalEta | null {
  if (observations.length === 0) return null

  const normalizedPodLocationCode = normalizeLocationCode(podLocationCode ?? null)
  const primaryObservations = derivePrimarySeriesObservations(observations, now)
  if (primaryObservations.length === 0) return null

  function locationCodesMatch(
    observationLocationCode: string | null | undefined,
    targetPodLocationCode: string,
  ): boolean {
    const normalizedObservationCode = normalizeLocationCode(observationLocationCode)
    if (!normalizedObservationCode) return false
    if (normalizedObservationCode === targetPodLocationCode) return true

    const observationRoot = normalizedObservationCode.slice(0, 5)
    const podRoot = targetPodLocationCode.slice(0, 5)
    return observationRoot.length === 5 && podRoot.length === 5 && observationRoot === podRoot
  }

  function safeFallbackExpectedArrival(): TrackingOperationalEta | null {
    const expectedArrivals = primaryObservations.filter(
      (observation) => observation.type === 'ARRIVAL' && observation.event_time_type === 'EXPECTED',
    )
    const latestExpectedArrival = latestObservation(expectedArrivals)
    if (!latestExpectedArrival) return null
    return toTrackingOperationalEta(latestExpectedArrival, now)
  }

  if (!normalizedPodLocationCode) {
    // Safe fallback without canonical POD:
    // choose only EXPECTED ARRIVAL and never ACTUAL generic arrival.
    return safeFallbackExpectedArrival()
  }

  const arrivalPrimaries = primaryObservations.filter(
    (observation) =>
      observation.type === 'ARRIVAL' &&
      locationCodesMatch(observation.location_code, normalizedPodLocationCode),
  )
  const arrivalAtPod = latestObservation(arrivalPrimaries)

  if (arrivalAtPod) {
    return toTrackingOperationalEta(arrivalAtPod, now)
  }

  const discharge = latestObservation(
    primaryObservations.filter(
      (observation) =>
        observation.type === 'DISCHARGE' &&
        locationCodesMatch(observation.location_code, normalizedPodLocationCode),
    ),
  )
  if (discharge) {
    return toTrackingOperationalEta(discharge, now)
  }

  const delivery = latestObservation(
    primaryObservations.filter(
      (observation) =>
        observation.type === 'DELIVERY' &&
        locationCodesMatch(observation.location_code, normalizedPodLocationCode),
    ),
  )
  if (delivery) {
    return toTrackingOperationalEta(delivery, now)
  }

  return null
}

function deriveOrderedRoutePorts(
  observations: readonly TrackingObservationForOperationalSummary[],
): readonly string[] {
  const orderedPorts: string[] = []
  const seenPorts = new Set<string>()
  const sorted = [...observations].sort(compareObservationsChronologically)

  for (const observation of sorted) {
    const isRouteType = ROUTE_TYPES.some((type) => type === observation.type)
    if (!isRouteType) continue

    const code = normalizeLocationCode(observation.location_code)
    if (!code || seenPorts.has(code)) continue

    seenPorts.add(code)
    orderedPorts.push(code)
  }

  return orderedPorts
}

function buildDisplayByCode(
  observations: readonly TrackingObservationForOperationalSummary[],
): ReadonlyMap<string, string> {
  const displaysByCode = new Map<string, string>()
  const sorted = [...observations].sort(compareObservationsChronologically)

  for (const observation of sorted) {
    const code = normalizeLocationCode(observation.location_code)
    const display = normalizeLocationDisplay(observation.location_display)
    if (!code || !display || displaysByCode.has(code)) continue
    displaysByCode.set(code, display)
  }

  return displaysByCode
}

function normalizeTransshipment(
  observations: readonly TrackingObservationForOperationalSummary[],
  transshipment: TransshipmentInfo,
): TrackingOperationalTransshipment {
  const routePorts = deriveOrderedRoutePorts(observations)
  const displaysByCode = buildDisplayByCode(observations)

  const routeStart = routePorts[0] ?? null
  const routeEnd = routePorts.length > 1 ? routePorts[routePorts.length - 1] : null

  const normalizedPorts: string[] = []
  const seenPorts = new Set<string>()

  for (const rawPort of transshipment.ports) {
    const code = normalizeLocationCode(rawPort)
    if (!code || seenPorts.has(code)) continue
    seenPorts.add(code)
    normalizedPorts.push(code)
  }

  const intermediatePorts = normalizedPorts.filter(
    (code) => code !== routeStart && code !== routeEnd,
  )

  const ports = intermediatePorts.map((code) => ({
    code,
    display: displaysByCode.get(code) ?? null,
  }))

  return {
    hasTransshipment: ports.length > 0,
    count: ports.length,
    ports,
  }
}

function toTrackingLifecycleBucket(status: string): TrackingLifecycleBucket {
  if (status === 'DELIVERED' || status === 'EMPTY_RETURNED') return 'final_delivery'
  if (status === 'ARRIVED_AT_POD' || status === 'DISCHARGED' || status === 'AVAILABLE_FOR_PICKUP') {
    return 'post_arrival_pre_delivery'
  }
  return 'pre_arrival'
}

function isEtaApplicable(bucket: TrackingLifecycleBucket): boolean {
  return bucket === 'pre_arrival'
}

export function createTrackingOperationalSummaryFallback(
  dataIssue: boolean = false,
): TrackingOperationalSummary {
  const lifecycleBucket = toTrackingLifecycleBucket('UNKNOWN')
  return {
    status: 'UNKNOWN',
    eta: null,
    etaApplicable: isEtaApplicable(lifecycleBucket),
    lifecycleBucket,
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    dataIssue,
  }
}

export function deriveTrackingOperationalSummary(
  args: DeriveTrackingOperationalSummaryArgs,
): TrackingOperationalSummary {
  const lifecycleBucket = toTrackingLifecycleBucket(args.status)
  const etaApplicable = isEtaApplicable(lifecycleBucket)

  return {
    status: args.status,
    eta: etaApplicable
      ? deriveEtaFromSeries(args.observations, args.podLocationCode, args.now)
      : null,
    etaApplicable,
    lifecycleBucket,
    transshipment: normalizeTransshipment(args.observations, args.transshipment),
    dataIssue: args.dataIssue ?? false,
  }
}
