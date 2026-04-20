import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type {
  SeriesLabel,
  TrackingSeriesConflict,
} from '~/modules/tracking/features/series/domain/reconcile/seriesClassification'
import type {
  TrackingSeriesHistory,
  TrackingSeriesHistoryItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { compareObservationsChronologically } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseTemporalValueDto } from '~/shared/time/parsing'

export type TrackingPredictionHistoryHeaderTone = 'danger' | 'warning' | 'neutral'
export type TrackingPredictionHistoryHeaderSummaryKind =
  | 'SINGLE_VERSION'
  | 'HISTORY_UPDATED'
  | 'CONFLICT_DETECTED'
export type TrackingPredictionHistoryVersionState =
  | 'CONFIRMED'
  | 'CONFIRMED_BEFORE'
  | 'SUBSTITUTED'
  | 'ESTIMATE_CHANGED'
  | 'INITIAL'
export type TrackingPredictionHistoryTransitionKind =
  | 'EVENT_CONFIRMED'
  | 'ESTIMATE_CHANGED'
  | 'PREVIOUS_VERSION_SUBSTITUTED'
  | 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
export type TrackingPredictionHistoryExplanatoryTextKind = 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER'

export type TrackingPredictionHistoryVersion = {
  readonly id: string
  readonly is_current: boolean
  readonly type: string
  readonly event_time: TemporalValueDto | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly version_state: TrackingPredictionHistoryVersionState
  readonly explanatory_text_kind: TrackingPredictionHistoryExplanatoryTextKind | null
  readonly transition_kind_from_previous_version: TrackingPredictionHistoryTransitionKind | null
  readonly observed_at_count: number
  readonly observed_at_list: readonly string[]
  readonly first_observed_at: string
  readonly last_observed_at: string
}

export type TrackingPredictionHistoryReadModel = {
  readonly header: {
    readonly tone: TrackingPredictionHistoryHeaderTone
    readonly summary_kind: TrackingPredictionHistoryHeaderSummaryKind
    readonly current_version_id: string
    readonly previous_version_id: string | null
    readonly original_version_id: string | null
    readonly reason_kind: TrackingPredictionHistoryTransitionKind | null
  }
  readonly versions: readonly TrackingPredictionHistoryVersion[]
}

type VersionGroup = {
  readonly id: string
  readonly type: string
  readonly event_time: TemporalValueDto | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly representative: TrackingSeriesHistoryItem
  readonly members: readonly TrackingSeriesHistoryItem[]
  readonly observed_at_list: readonly string[]
  readonly first_observed_at: string
  readonly last_observed_at: string
  readonly sequence: number
  readonly containsCurrent: boolean
}

type VersionIdentity = {
  readonly vesselName: string | null
  readonly voyage: string | null
}

function normalizeVoyage(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function normalizeEventTimeIdentity(eventTime: TemporalValueDto | null): string {
  if (eventTime === null) return 'null'

  let timezone = ''
  if (eventTime.kind === 'date') {
    timezone = eventTime.timezone ?? ''
  } else if (eventTime.kind === 'local-datetime') {
    timezone = eventTime.timezone
  }

  return `${eventTime.kind}|${eventTime.value}|${timezone}`
}

function toVersionIdentity(item: {
  readonly vessel_name: string | null
  readonly voyage: string | null
}): VersionIdentity {
  return {
    vesselName: normalizeVesselName(item.vessel_name),
    voyage: normalizeVoyage(item.voyage),
  }
}

function hasVersionIdentityChange(left: VersionGroup, right: VersionGroup): boolean {
  const leftIdentity = toVersionIdentity(left)
  const rightIdentity = toVersionIdentity(right)

  return (
    leftIdentity.vesselName !== rightIdentity.vesselName ||
    leftIdentity.voyage !== rightIdentity.voyage
  )
}

function isCurrentSeriesLabel(label: SeriesLabel): boolean {
  return label === 'ACTIVE' || label === 'CONFIRMED'
}

function compareHistoryItemsByObservedAt(
  left: TrackingSeriesHistoryItem,
  right: TrackingSeriesHistoryItem,
): number {
  const createdCompare = left.created_at.localeCompare(right.created_at)
  if (createdCompare !== 0) {
    return createdCompare
  }

  return compareObservationsChronologically(
    {
      event_time: left.event_time === null ? null : parseTemporalValueDto(left.event_time),
      event_time_type: left.event_time_type,
      created_at: left.created_at,
    },
    {
      event_time: right.event_time === null ? null : parseTemporalValueDto(right.event_time),
      event_time_type: right.event_time_type,
      created_at: right.created_at,
    },
  )
}

function sortHistoryItemsByObservedAt(
  items: readonly TrackingSeriesHistoryItem[],
): readonly TrackingSeriesHistoryItem[] {
  if (items.length < 2) return items
  return [...items].sort(compareHistoryItemsByObservedAt)
}

function versionGroupKey(item: TrackingSeriesHistoryItem): string {
  return [
    item.type,
    normalizeEventTimeIdentity(item.event_time),
    item.event_time_type,
    normalizeVesselName(item.vesselName),
    normalizeVoyage(item.voyage),
  ].join('|')
}

function toVersionGroup(
  items: readonly TrackingSeriesHistoryItem[],
  sequence: number,
): VersionGroup {
  const representative = items[items.length - 1]
  if (representative === undefined) {
    throw new Error('Prediction history version group cannot be empty')
  }

  const observed_at_list = [...items.map((item) => item.created_at)].sort((left, right) =>
    left.localeCompare(right),
  )
  const first_observed_at = observed_at_list[0]
  const last_observed_at = observed_at_list[observed_at_list.length - 1]

  if (first_observed_at === undefined || last_observed_at === undefined) {
    throw new Error('Prediction history version group requires observed_at values')
  }

  return {
    id: representative.id,
    type: representative.type,
    event_time: representative.event_time,
    event_time_type: representative.event_time_type,
    vessel_name: representative.vesselName ?? null,
    voyage: representative.voyage ?? null,
    representative,
    members: items,
    observed_at_list,
    first_observed_at,
    last_observed_at,
    sequence,
    containsCurrent: items.some((item) => isCurrentSeriesLabel(item.seriesLabel)),
  }
}

function buildVersionGroups(seriesHistory: TrackingSeriesHistory): readonly VersionGroup[] {
  const observedOrder = sortHistoryItemsByObservedAt(seriesHistory.classified)
  if (observedOrder.length === 0) return []

  const groups: VersionGroup[] = []
  let currentGroupItems: TrackingSeriesHistoryItem[] = []
  let currentKey: string | null = null

  for (const item of observedOrder) {
    const nextKey = versionGroupKey(item)
    if (currentKey === null || currentKey === nextKey) {
      currentGroupItems.push(item)
      currentKey = nextKey
      continue
    }

    groups.push(toVersionGroup(currentGroupItems, groups.length))
    currentGroupItems = [item]
    currentKey = nextKey
  }

  if (currentGroupItems.length > 0) {
    groups.push(toVersionGroup(currentGroupItems, groups.length))
  }

  return groups
}

function resolveCurrentGroup(groups: readonly VersionGroup[]): VersionGroup {
  const current = groups.find((group) => group.containsCurrent) ?? groups[groups.length - 1]

  if (current === undefined) {
    throw new Error('Prediction history requires at least one version group')
  }

  return current
}

function toDisplayOrder(
  groups: readonly VersionGroup[],
  currentGroupId: string,
): readonly VersionGroup[] {
  const currentGroup = groups.find((group) => group.id === currentGroupId)
  if (currentGroup === undefined) return groups

  const historical = groups
    .filter((group) => group.id !== currentGroupId)
    .sort((left, right) => {
      const observedCompare = right.last_observed_at.localeCompare(left.last_observed_at)
      if (observedCompare !== 0) return observedCompare
      return right.sequence - left.sequence
    })

  return [currentGroup, ...historical]
}

function isVoyageChangedAfterConfirmationConflict(
  conflict: TrackingSeriesConflict | null | undefined,
): boolean {
  return conflict?.kind === 'VOYAGE_MISMATCH_AFTER_ACTUAL_CONFIRMATION'
}

function resolveTransitionKind(command: {
  readonly newer: VersionGroup
  readonly older: VersionGroup | undefined
  readonly hasActualConflict: boolean
  readonly hasVoyageCorrectionConflict: boolean
}): TrackingPredictionHistoryTransitionKind | null {
  if (command.older === undefined) return null

  if (
    command.hasVoyageCorrectionConflict &&
    command.newer.event_time_type === 'ACTUAL' &&
    command.older.event_time_type === 'ACTUAL'
  ) {
    return 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
  }

  if (
    command.newer.representative.seriesLabel === 'CONFIRMED' &&
    command.older.event_time_type === 'EXPECTED'
  ) {
    return 'EVENT_CONFIRMED'
  }

  if (!command.hasActualConflict && hasVersionIdentityChange(command.newer, command.older)) {
    return 'PREVIOUS_VERSION_SUBSTITUTED'
  }

  return 'ESTIMATE_CHANGED'
}

function resolveVersionState(command: {
  readonly group: VersionGroup
  readonly displayOrder: readonly VersionGroup[]
  readonly index: number
  readonly currentGroupId: string
  readonly hasActualConflict: boolean
}): TrackingPredictionHistoryVersionState {
  if (command.displayOrder.length === 1) {
    return 'INITIAL'
  }

  if (command.group.id === command.currentGroupId) {
    return command.group.representative.seriesLabel === 'CONFIRMED'
      ? 'CONFIRMED'
      : 'ESTIMATE_CHANGED'
  }

  if (command.group.representative.seriesLabel === 'CONFLICTING_ACTUAL') {
    return 'CONFIRMED_BEFORE'
  }

  const newer = command.displayOrder[command.index - 1]

  if (
    command.group.event_time_type === 'EXPECTED' &&
    newer !== undefined &&
    !command.hasActualConflict &&
    hasVersionIdentityChange(command.group, newer)
  ) {
    return 'SUBSTITUTED'
  }

  return command.index === command.displayOrder.length - 1 ? 'INITIAL' : 'ESTIMATE_CHANGED'
}

function resolveExplanatoryTextKind(command: {
  readonly group: VersionGroup
  readonly currentGroupId: string
  readonly hasVoyageCorrectionConflict: boolean
}): TrackingPredictionHistoryExplanatoryTextKind | null {
  if (command.group.id === command.currentGroupId) {
    return null
  }

  if (
    command.hasVoyageCorrectionConflict &&
    command.group.representative.seriesLabel === 'CONFLICTING_ACTUAL'
  ) {
    return 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER'
  }

  return null
}

function resolveHeaderReasonKind(
  versions: readonly TrackingPredictionHistoryVersion[],
): TrackingPredictionHistoryTransitionKind | null {
  if (versions.length < 2) return null

  if (
    versions.some(
      (version) =>
        version.transition_kind_from_previous_version === 'VOYAGE_CHANGED_AFTER_CONFIRMATION',
    )
  ) {
    return 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
  }

  if (
    versions.some((version) => version.transition_kind_from_previous_version === 'ESTIMATE_CHANGED')
  ) {
    return 'ESTIMATE_CHANGED'
  }

  if (
    versions.some(
      (version) => version.transition_kind_from_previous_version === 'PREVIOUS_VERSION_SUBSTITUTED',
    )
  ) {
    return 'PREVIOUS_VERSION_SUBSTITUTED'
  }

  return versions[0]?.transition_kind_from_previous_version ?? null
}

export function buildTrackingPredictionHistoryReadModel(
  seriesHistory: TrackingSeriesHistory,
): TrackingPredictionHistoryReadModel | null {
  const groupsInObservedOrder = buildVersionGroups(seriesHistory)
  if (groupsInObservedOrder.length === 0) return null

  const currentGroup = resolveCurrentGroup(groupsInObservedOrder)
  const hasVoyageCorrectionConflict = isVoyageChangedAfterConfirmationConflict(
    seriesHistory.conflict,
  )
  const displayOrder = toDisplayOrder(groupsInObservedOrder, currentGroup.id)

  const versions = displayOrder.map((group, index) => ({
    id: group.id,
    is_current: group.id === currentGroup.id,
    type: group.type,
    event_time: group.event_time,
    event_time_type: group.event_time_type,
    vessel_name: group.vessel_name,
    voyage: group.voyage,
    version_state: resolveVersionState({
      group,
      displayOrder,
      index,
      currentGroupId: currentGroup.id,
      hasActualConflict: seriesHistory.hasActualConflict,
    }),
    explanatory_text_kind: resolveExplanatoryTextKind({
      group,
      currentGroupId: currentGroup.id,
      hasVoyageCorrectionConflict,
    }),
    transition_kind_from_previous_version: resolveTransitionKind({
      newer: group,
      older: displayOrder[index + 1],
      hasActualConflict: seriesHistory.hasActualConflict,
      hasVoyageCorrectionConflict,
    }),
    observed_at_count: group.observed_at_list.length,
    observed_at_list: [...group.observed_at_list],
    first_observed_at: group.first_observed_at,
    last_observed_at: group.last_observed_at,
  }))

  const originalGroup = groupsInObservedOrder[0]
  const previousGroup = displayOrder[1]
  let summaryKind: TrackingPredictionHistoryHeaderSummaryKind = 'HISTORY_UPDATED'
  if (versions.length === 1) {
    summaryKind = 'SINGLE_VERSION'
  } else if (hasVoyageCorrectionConflict) {
    summaryKind = 'CONFLICT_DETECTED'
  }

  return {
    header: {
      tone: summaryKind === 'CONFLICT_DETECTED' ? 'danger' : 'neutral',
      summary_kind: summaryKind,
      current_version_id: currentGroup.id,
      previous_version_id: summaryKind === 'CONFLICT_DETECTED' ? (previousGroup?.id ?? null) : null,
      original_version_id: summaryKind === 'HISTORY_UPDATED' ? (originalGroup?.id ?? null) : null,
      reason_kind: resolveHeaderReasonKind(versions),
    },
    versions,
  }
}
