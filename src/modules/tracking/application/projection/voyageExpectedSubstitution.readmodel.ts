import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type {
  ClassifiedObservation,
  SeriesLabel,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TemporalValue } from '~/shared/time/temporal-value'

const TERMINAL_MILESTONE_TYPES: ReadonlySet<string> = new Set(['ARRIVAL', 'DISCHARGE', 'DELIVERY'])
const MARITIME_MILESTONE_TYPES: ReadonlySet<string> = new Set([
  'LOAD',
  'DEPARTURE',
  'ARRIVAL',
  'DISCHARGE',
])

export type VoyageExpectedSubstitutionObservation = {
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

export type VoyageExpectedSubstitutionCandidate<
  T extends VoyageExpectedSubstitutionObservation = VoyageExpectedSubstitutionObservation,
> = {
  readonly primary: T
  readonly classified: readonly ClassifiedObservation<T>[]
  readonly hasActualConflict: boolean
}

export type VoyageExpectedSubstitutionResult<
  T extends VoyageExpectedSubstitutionObservation = VoyageExpectedSubstitutionObservation,
> = {
  readonly visibleCandidates: readonly VoyageExpectedSubstitutionCandidate<T>[]
  readonly mergedSuppressedHistoryByPrimaryId: ReadonlyMap<
    string,
    readonly ClassifiedObservation<T>[]
  >
}

type WorkingCandidate<T extends VoyageExpectedSubstitutionObservation> = {
  readonly candidate: VoyageExpectedSubstitutionCandidate<T>
  readonly mergedSuppressedHistory: readonly ClassifiedObservation<T>[]
}

function normalizeLocationAnchor(
  observation: Pick<VoyageExpectedSubstitutionObservation, 'location_code' | 'location_display'>,
): string | null {
  const normalizedCode = observation.location_code?.trim().toUpperCase() ?? ''
  if (normalizedCode.length >= 5) {
    return normalizedCode.slice(0, 5)
  }
  if (normalizedCode.length > 0) {
    return normalizedCode
  }

  const normalizedDisplay = observation.location_display?.trim().toUpperCase() ?? ''
  return normalizedDisplay.length > 0 ? normalizedDisplay : null
}

function normalizeVoyage(voyage: string | null | undefined): string | null {
  const normalized = voyage?.trim().toUpperCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function isEligibleTerminalExpected(observation: VoyageExpectedSubstitutionObservation): boolean {
  return (
    observation.event_time_type === 'EXPECTED' &&
    TERMINAL_MILESTONE_TYPES.has(observation.type) &&
    normalizeLocationAnchor(observation) !== null
  )
}

function compareByCreatedAtThenChronology(
  left: VoyageExpectedSubstitutionObservation,
  right: VoyageExpectedSubstitutionObservation,
): number {
  const createdCompare = left.created_at.localeCompare(right.created_at)
  if (createdCompare !== 0) {
    return createdCompare
  }

  const specificityCompare = specificityScore(left) - specificityScore(right)
  if (specificityCompare !== 0) {
    return specificityCompare
  }

  return compareObservationsChronologically(left, right)
}

function specificityScore(observation: VoyageExpectedSubstitutionObservation): number {
  let score = 0
  if (normalizeVesselName(observation.vessel_name) !== null) score += 1
  if (normalizeVoyage(observation.voyage) !== null) score += 1
  return score
}

function sharesPromotedLegIdentity(
  support: VoyageExpectedSubstitutionObservation,
  promoted: VoyageExpectedSubstitutionObservation,
): boolean {
  const promotedVessel = normalizeVesselName(promoted.vessel_name)
  const promotedVoyage = normalizeVoyage(promoted.voyage)
  if (promotedVessel === null && promotedVoyage === null) return false

  const supportVessel = normalizeVesselName(support.vessel_name)
  const supportVoyage = normalizeVoyage(support.voyage)

  const vesselMatches = promotedVessel !== null && supportVessel === promotedVessel
  const voyageMatches = promotedVoyage !== null && supportVoyage === promotedVoyage
  const vesselCompatible =
    promotedVessel === null || supportVessel === null || supportVessel === promotedVessel
  const voyageCompatible =
    promotedVoyage === null || supportVoyage === null || supportVoyage === promotedVoyage

  return (vesselMatches || voyageMatches) && vesselCompatible && voyageCompatible
}

function isEarlierFutureChainSupport(
  support: VoyageExpectedSubstitutionObservation,
  promoted: VoyageExpectedSubstitutionObservation,
): boolean {
  if (support.event_time_type !== 'EXPECTED') return false
  if (support.event_time === null || promoted.event_time === null) return false

  return compareObservationsChronologically(support, promoted) < 0
}

function hasCoherentFutureChainEvidence<T extends VoyageExpectedSubstitutionObservation>(
  promoted: T,
  allPrimaries: readonly T[],
): boolean {
  const promotedAnchor = normalizeLocationAnchor(promoted)
  if (promotedAnchor === null) return false

  for (const support of allPrimaries) {
    if (support.id === promoted.id) continue
    if (!isEarlierFutureChainSupport(support, promoted)) continue

    const supportAnchor = normalizeLocationAnchor(support)
    if (supportAnchor !== null && supportAnchor === promotedAnchor) {
      continue
    }

    if (support.type === 'TRANSSHIPMENT_INTENDED') {
      return true
    }

    if (
      MARITIME_MILESTONE_TYPES.has(support.type) &&
      sharesPromotedLegIdentity(support, promoted)
    ) {
      return true
    }
  }

  return false
}

function relabelSuppressedSeriesHistory<T extends VoyageExpectedSubstitutionObservation>(
  classified: readonly ClassifiedObservation<T>[],
): readonly ClassifiedObservation<T>[] {
  return classified.map((entry) => {
    const seriesLabel: SeriesLabel =
      entry.seriesLabel === 'ACTIVE' ? 'SUPERSEDED_EXPECTED' : entry.seriesLabel

    return seriesLabel === entry.seriesLabel ? entry : { ...entry, seriesLabel }
  })
}

function sortClassifiedObservations<T extends VoyageExpectedSubstitutionObservation>(
  classified: readonly ClassifiedObservation<T>[],
): readonly ClassifiedObservation<T>[] {
  if (classified.length < 2) return classified
  return [...classified].sort(compareObservationsChronologically)
}

function canBeSuppressedBy<T extends VoyageExpectedSubstitutionObservation>(
  older: T,
  newer: T,
  allPrimaries: readonly T[],
): boolean {
  if (older.created_at > newer.created_at) return false
  if (older.type !== newer.type) return false

  const olderAnchor = normalizeLocationAnchor(older)
  const newerAnchor = normalizeLocationAnchor(newer)
  if (olderAnchor === null || newerAnchor === null || olderAnchor !== newerAnchor) return false

  if (specificityScore(newer) <= specificityScore(older)) return false

  return hasCoherentFutureChainEvidence(newer, allPrimaries)
}

export function applyVoyageExpectedSubstitution<T extends VoyageExpectedSubstitutionObservation>(
  candidates: readonly VoyageExpectedSubstitutionCandidate<T>[],
): VoyageExpectedSubstitutionResult<T> {
  if (candidates.length < 2) {
    return {
      visibleCandidates: candidates,
      mergedSuppressedHistoryByPrimaryId: new Map(),
    }
  }

  const allPrimaries = candidates.map((candidate) => candidate.primary)
  const nonEligible: WorkingCandidate<T>[] = []
  const eligibleGroups = new Map<string, VoyageExpectedSubstitutionCandidate<T>[]>()

  for (const candidate of candidates) {
    if (!isEligibleTerminalExpected(candidate.primary)) {
      nonEligible.push({
        candidate,
        mergedSuppressedHistory: [],
      })
      continue
    }

    const anchor = normalizeLocationAnchor(candidate.primary)
    if (anchor === null) {
      nonEligible.push({
        candidate,
        mergedSuppressedHistory: [],
      })
      continue
    }

    const groupKey = `${candidate.primary.type}|${anchor}`
    const existing = eligibleGroups.get(groupKey)
    if (existing === undefined) {
      eligibleGroups.set(groupKey, [candidate])
    } else {
      existing.push(candidate)
    }
  }

  const visibleWorking: WorkingCandidate<T>[] = [...nonEligible]

  for (const group of eligibleGroups.values()) {
    const orderedGroup = [...group].sort((left, right) =>
      compareByCreatedAtThenChronology(left.primary, right.primary),
    )

    let visibleGroup: WorkingCandidate<T>[] = []

    for (const candidate of orderedGroup) {
      let mergedSuppressedHistory: readonly ClassifiedObservation<T>[] = []
      const survivors: WorkingCandidate<T>[] = []

      for (const prior of visibleGroup) {
        if (canBeSuppressedBy(prior.candidate.primary, candidate.primary, allPrimaries)) {
          mergedSuppressedHistory = [
            ...mergedSuppressedHistory,
            ...relabelSuppressedSeriesHistory(prior.candidate.classified),
            ...prior.mergedSuppressedHistory,
          ]
          continue
        }

        survivors.push(prior)
      }

      visibleGroup = [
        ...survivors,
        {
          candidate,
          mergedSuppressedHistory: sortClassifiedObservations(mergedSuppressedHistory),
        },
      ]
    }

    visibleWorking.push(...visibleGroup)
  }

  const visibleCandidates = visibleWorking
    .map((entry) => entry.candidate)
    .sort((left, right) => compareObservationsChronologically(left.primary, right.primary))

  const mergedSuppressedHistoryByPrimaryId = new Map<string, readonly ClassifiedObservation<T>[]>()
  for (const entry of visibleWorking) {
    if (entry.mergedSuppressedHistory.length === 0) continue
    mergedSuppressedHistoryByPrimaryId.set(
      entry.candidate.primary.id,
      entry.mergedSuppressedHistory,
    )
  }

  return {
    visibleCandidates,
    mergedSuppressedHistoryByPrimaryId,
  }
}
