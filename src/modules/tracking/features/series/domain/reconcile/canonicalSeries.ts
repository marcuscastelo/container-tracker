import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import { trackingTemporalValueToDto } from '~/modules/tracking/domain/temporal/tracking-temporal'
import {
  classifySeries,
  type ObservationLike,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import {
  buildSeriesKey,
  compareObservationsChronologically,
} from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Instant } from '~/shared/time/instant'

export type CanonicalSeriesObservation = ObservationLike & {
  readonly id: string
  readonly type: string
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
}

export type CanonicalSeriesGroup<
  T extends CanonicalSeriesObservation = CanonicalSeriesObservation,
> = {
  readonly key: string
  readonly observations: readonly T[]
}

type BaseSeriesCandidate<T extends CanonicalSeriesObservation> = {
  readonly baseKey: string
  readonly observations: readonly T[]
  readonly mergeSignature: string | null
}

function normalizeLocationAnchor(
  observation: Pick<CanonicalSeriesObservation, 'location_code' | 'location_display'>,
): string | null {
  const locationCode = observation.location_code?.trim().toUpperCase() ?? ''
  if (locationCode.length >= 5) {
    return locationCode.slice(0, 5)
  }

  if (locationCode.length > 0) {
    return locationCode
  }

  const locationDisplay = observation.location_display?.trim().toUpperCase() ?? ''
  return locationDisplay.length > 0 ? locationDisplay : null
}

function resolveActualEventDayAnchor(observation: ObservationLike): string | null {
  if (observation.event_time === null) return null

  const dto = trackingTemporalValueToDto(observation.event_time)
  if (dto === null) return null

  return dto.kind === 'date' ? dto.value : dto.value.slice(0, 10)
}

function resolveMergeSignature<T extends CanonicalSeriesObservation>(
  observations: readonly T[],
  now: Instant,
): string | null {
  const classification = classifySeries(observations, now)
  const primary = classification.primary

  if (primary === null || primary.event_time_type !== 'ACTUAL') return null
  if (primary.type !== 'DISCHARGE') return null

  const locationAnchor = normalizeLocationAnchor(primary)
  const normalizedVessel = normalizeVesselName(primary.vessel_name)
  const eventDayAnchor = resolveActualEventDayAnchor(primary)

  if (locationAnchor === null || normalizedVessel === null || eventDayAnchor === null) {
    return null
  }

  return `DISCHARGE|${locationAnchor}|${normalizedVessel}|${eventDayAnchor}`
}

function toBaseSeriesCandidates<T extends CanonicalSeriesObservation>(
  observations: readonly T[],
  now: Instant,
): readonly BaseSeriesCandidate<T>[] {
  const seriesByKey = new Map<string, T[]>()

  for (const observation of observations) {
    const seriesKey = buildSeriesKey(observation)
    const existing = seriesByKey.get(seriesKey)
    if (existing === undefined) {
      seriesByKey.set(seriesKey, [observation])
      continue
    }

    existing.push(observation)
  }

  return [...seriesByKey.entries()].map(([baseKey, series]) => {
    const sorted = [...series].sort(compareObservationsChronologically)
    return {
      baseKey,
      observations: sorted,
      mergeSignature: resolveMergeSignature(sorted, now),
    }
  })
}

export function buildCanonicalSeriesGroups<T extends CanonicalSeriesObservation>(
  observations: readonly T[],
  now: Instant,
): readonly CanonicalSeriesGroup<T>[] {
  if (observations.length === 0) return []

  const baseCandidates = toBaseSeriesCandidates(observations, now)
  const seriesKeysByMergeSignature = new Map<string, string[]>()

  for (const candidate of baseCandidates) {
    if (candidate.mergeSignature === null) continue

    const existing = seriesKeysByMergeSignature.get(candidate.mergeSignature)
    if (existing === undefined) {
      seriesKeysByMergeSignature.set(candidate.mergeSignature, [candidate.baseKey])
      continue
    }

    existing.push(candidate.baseKey)
  }

  const candidatesByBaseKey = new Map(
    baseCandidates.map((candidate) => [candidate.baseKey, candidate] as const),
  )
  const emittedSeriesKeys = new Set<string>()
  const canonicalGroups: CanonicalSeriesGroup<T>[] = []

  for (const candidate of baseCandidates) {
    if (emittedSeriesKeys.has(candidate.baseKey)) continue

    if (candidate.mergeSignature === null) {
      emittedSeriesKeys.add(candidate.baseKey)
      canonicalGroups.push({
        key: candidate.baseKey,
        observations: candidate.observations,
      })
      continue
    }

    const siblingSeriesKeys = seriesKeysByMergeSignature.get(candidate.mergeSignature) ?? [
      candidate.baseKey,
    ]

    if (siblingSeriesKeys.length < 2) {
      emittedSeriesKeys.add(candidate.baseKey)
      canonicalGroups.push({
        key: candidate.baseKey,
        observations: candidate.observations,
      })
      continue
    }

    const mergedObservations = siblingSeriesKeys
      .flatMap((seriesKey) => candidatesByBaseKey.get(seriesKey)?.observations ?? [])
      .sort(compareObservationsChronologically)

    for (const seriesKey of siblingSeriesKeys) {
      emittedSeriesKeys.add(seriesKey)
    }

    canonicalGroups.push({
      key: `merged-discharge:${candidate.mergeSignature}`,
      observations: mergedObservations,
    })
  }

  return canonicalGroups
}
