import { applyVoyageExpectedSubstitution } from '~/modules/tracking/application/projection/voyageExpectedSubstitution.readmodel'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { isTrackingTemporalValueExpired } from '~/modules/tracking/domain/temporal/tracking-temporal'
import {
  type ClassifiedObservation,
  classifySeries,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
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
const ROUTE_TYPES = ['LOAD', 'DISCHARGE', 'ARRIVAL', 'DEPARTURE'] as const
const TERMINAL_MILESTONE_TYPES = ['ARRIVAL', 'DISCHARGE', 'DELIVERY'] as const

export type TrackingOperationalEta = {
  readonly eventTime: TemporalValueDto
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly state: TrackingOperationalEtaState
  readonly type: string
  readonly locationCode: string | null
  readonly locationDisplay: string | null
}

export type TrackingOperationalCurrentContext = {
  readonly locationCode: string | null
  readonly locationDisplay: string | null
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly vesselVisible: boolean
}

export type TrackingOperationalNextLocation = {
  readonly eventTime: TemporalValueDto
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
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
  readonly currentContext: TrackingOperationalCurrentContext
  readonly nextLocation: TrackingOperationalNextLocation | null
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
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

  const candidates: Array<{
    readonly primary: TrackingObservationForOperationalSummary
    readonly classified: readonly ClassifiedObservation<TrackingObservationForOperationalSummary>[]
    readonly hasActualConflict: boolean
  }> = []

  for (const series of groups.values()) {
    series.sort(compareObservationsChronologically)
    const classification = classifySeries(series, now)
    if (classification.primary) {
      candidates.push({
        primary: classification.primary,
        classified: classification.classified,
        hasActualConflict: classification.hasActualConflict,
      })
      continue
    }

    // For operational ETA visibility we keep expired EXPECTED as fallback
    // when a series has no ACTUAL (safe-first still picks latest EXPECTED).
    const latestExpected = [...series]
      .reverse()
      .find((observation) => observation.event_time_type === 'EXPECTED')

    if (latestExpected) {
      candidates.push({
        primary: latestExpected,
        classified: classification.classified,
        hasActualConflict: classification.hasActualConflict,
      })
    }
  }

  return applyVoyageExpectedSubstitution(candidates).visibleCandidates.map(
    (candidate) => candidate.primary,
  )
}

function locationCodesMatch(
  observationLocationCode: string | null | undefined,
  targetLocationCode: string,
): boolean {
  const normalizedObservationCode = normalizeLocationCode(observationLocationCode)
  if (!normalizedObservationCode) return false
  if (normalizedObservationCode === targetLocationCode) return true

  const observationRoot = normalizedObservationCode.slice(0, 5)
  const targetRoot = targetLocationCode.slice(0, 5)
  return observationRoot.length === 5 && targetRoot.length === 5 && observationRoot === targetRoot
}

function resolveTerminalLocationCode(
  observations: readonly TrackingObservationForOperationalSummary[],
  podLocationCode: string | null | undefined,
): string | null {
  const normalizedPodLocationCode = normalizeLocationCode(podLocationCode ?? null)
  if (normalizedPodLocationCode !== null) {
    return normalizedPodLocationCode
  }

  const routePorts = deriveOrderedRoutePorts(observations)
  return routePorts.length > 0 ? (routePorts[routePorts.length - 1] ?? null) : null
}

function findLatestTerminalObservation(
  primaryObservations: readonly TrackingObservationForOperationalSummary[],
  terminalLocationCode: string,
  options?: {
    readonly expectedOnly?: boolean
  },
): TrackingObservationForOperationalSummary | null {
  for (const type of TERMINAL_MILESTONE_TYPES) {
    const candidates = primaryObservations.filter((observation) => {
      if (observation.type !== type) return false
      if (!locationCodesMatch(observation.location_code, terminalLocationCode)) return false
      if (options?.expectedOnly === true && observation.event_time_type !== 'EXPECTED') return false
      return true
    })

    const latestCandidate = latestObservation(candidates)
    if (latestCandidate !== null) {
      return latestCandidate
    }
  }

  return null
}

function latestPreferredPrimaryObservation(
  primaryObservations: readonly TrackingObservationForOperationalSummary[],
  hasValue: (observation: TrackingObservationForOperationalSummary) => boolean,
): TrackingObservationForOperationalSummary | null {
  const actualCandidate = latestObservation(
    primaryObservations.filter(
      (observation) => observation.event_time_type === 'ACTUAL' && hasValue(observation),
    ),
  )
  if (actualCandidate !== null) {
    return actualCandidate
  }

  return latestObservation(primaryObservations.filter(hasValue))
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

function toTrackingOperationalNextLocation(
  observation: TrackingObservationForOperationalSummary | null,
): TrackingOperationalNextLocation | null {
  if (observation === null || observation.event_time === null) {
    return null
  }

  return {
    eventTime: toTemporalValueDto(observation.event_time),
    eventTimeType: observation.event_time_type,
    type: observation.type,
    locationCode: normalizeLocationCode(observation.location_code),
    locationDisplay: normalizeLocationDisplay(observation.location_display),
  }
}

function isCurrentVesselVisible(
  primaryObservations: readonly TrackingObservationForOperationalSummary[],
  terminalLocationCode: string | null,
): boolean {
  if (terminalLocationCode === null) return true

  const sorted = [...primaryObservations].sort(compareObservationsChronologically)
  let latestTerminalDischargeIndex = -1

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const observation = sorted[index]
    if (observation === undefined) continue
    if (observation.event_time_type !== 'ACTUAL') continue
    if (observation.type !== 'DISCHARGE') continue
    if (!locationCodesMatch(observation.location_code, terminalLocationCode)) continue

    latestTerminalDischargeIndex = index
    break
  }

  if (latestTerminalDischargeIndex < 0) return true

  for (let index = latestTerminalDischargeIndex + 1; index < sorted.length; index += 1) {
    const observation = sorted[index]
    if (observation === undefined) continue
    if (observation.event_time_type !== 'ACTUAL') continue

    if (
      observation.type === 'LOAD' ||
      observation.type === 'DEPARTURE' ||
      observation.type === 'ARRIVAL'
    ) {
      return true
    }
  }

  return false
}

function deriveCurrentContext(
  observations: readonly TrackingObservationForOperationalSummary[],
  primaryObservations: readonly TrackingObservationForOperationalSummary[],
  podLocationCode: string | null | undefined,
): TrackingOperationalCurrentContext {
  const locationObservation = latestPreferredPrimaryObservation(
    primaryObservations,
    (observation) => {
      return (
        normalizeLocationDisplay(observation.location_display) !== null ||
        normalizeLocationCode(observation.location_code) !== null
      )
    },
  )
  const vesselObservation = latestPreferredPrimaryObservation(
    primaryObservations,
    (observation) => {
      return normalizeOptionalText(observation.vessel_name) !== null
    },
  )
  const terminalLocationCode = resolveTerminalLocationCode(observations, podLocationCode)

  return {
    locationCode:
      locationObservation === null
        ? null
        : normalizeLocationCode(locationObservation.location_code),
    locationDisplay:
      locationObservation === null
        ? null
        : normalizeLocationDisplay(locationObservation.location_display),
    vesselName:
      vesselObservation === null ? null : normalizeOptionalText(vesselObservation.vessel_name),
    voyage: vesselObservation === null ? null : normalizeOptionalText(vesselObservation.voyage),
    vesselVisible: isCurrentVesselVisible(primaryObservations, terminalLocationCode),
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

  function safeFallbackExpectedArrival(): TrackingOperationalEta | null {
    const expectedArrivals = primaryObservations.filter(
      (observation) => observation.type === 'ARRIVAL' && observation.event_time_type === 'EXPECTED',
    )
    const latestExpectedArrival = latestObservation(expectedArrivals)
    if (!latestExpectedArrival) return null
    return toTrackingOperationalEta(latestExpectedArrival, now)
  }

  if (!normalizedPodLocationCode) {
    const inferredTerminalLocationCode = resolveTerminalLocationCode(observations, null)
    if (inferredTerminalLocationCode === null) {
      // Safe fallback without canonical POD:
      // choose only EXPECTED ARRIVAL and never ACTUAL generic arrival.
      return safeFallbackExpectedArrival()
    }

    const terminalObservation = findLatestTerminalObservation(
      primaryObservations,
      inferredTerminalLocationCode,
    )
    return terminalObservation === null ? null : toTrackingOperationalEta(terminalObservation, now)
  }

  const terminalObservation = findLatestTerminalObservation(
    primaryObservations,
    normalizedPodLocationCode,
  )
  return terminalObservation === null ? null : toTrackingOperationalEta(terminalObservation, now)
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

function deriveNextLocation(
  observations: readonly TrackingObservationForOperationalSummary[],
  primaryObservations: readonly TrackingObservationForOperationalSummary[],
  podLocationCode: string | null | undefined,
): TrackingOperationalNextLocation | null {
  const terminalLocationCode = resolveTerminalLocationCode(observations, podLocationCode)
  if (terminalLocationCode === null) return null

  return toTrackingOperationalNextLocation(
    findLatestTerminalObservation(primaryObservations, terminalLocationCode, {
      expectedOnly: true,
    }),
  )
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
    currentContext: {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    },
    nextLocation: null,
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
  const primaryObservations = derivePrimarySeriesObservations(args.observations, args.now)
  const eta = etaApplicable
    ? deriveEtaFromSeries(args.observations, args.podLocationCode, args.now)
    : null

  return {
    status: args.status,
    eta,
    etaApplicable,
    lifecycleBucket,
    currentContext: deriveCurrentContext(
      args.observations,
      primaryObservations,
      args.podLocationCode,
    ),
    nextLocation:
      eta === null
        ? deriveNextLocation(args.observations, primaryObservations, args.podLocationCode)
        : {
            eventTime: eta.eventTime,
            eventTimeType: eta.eventTimeType,
            type: eta.type,
            locationCode: eta.locationCode,
            locationDisplay: eta.locationDisplay,
          },
    transshipment: normalizeTransshipment(args.observations, args.transshipment),
    dataIssue: args.dataIssue ?? false,
  }
}
