import { TRACKING_CHRONOLOGY_COMPARE_OPTIONS } from '~/modules/tracking/domain/temporal/tracking-temporal'
import { computeAlertFingerprint } from '~/modules/tracking/features/alerts/domain/identity/alertFingerprint'
import type { TrackingAlertDerivationState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  buildTimelineRenderList,
  type PlannedTransshipmentBlock,
  type TimelineRenderItem,
  type TransshipmentBlock,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import type { Instant } from '~/shared/time/instant'
import { parseTemporalValue } from '~/shared/time/parsing'

const UNKNOWN_VESSEL = 'UNKNOWN_VESSEL'

export type PlannedTransshipmentOccurrence = {
  readonly port: string
  readonly fromVessel: string
  readonly toVessel: string
  readonly detectedAt: string
  readonly sourceObservationFingerprints: readonly string[]
  readonly alertFingerprint: string
  readonly semanticKey: string
}

type PlannedTransshipmentAlertTransitions = {
  readonly occurrences: readonly PlannedTransshipmentOccurrence[]
  readonly alertIdsToAutoResolve: readonly string[]
}

type PlannedTransshipmentCandidateBlock = TransshipmentBlock & {
  readonly mode: 'planned'
  readonly events: readonly TrackingTimelineItem[]
}

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toUpperCase()
}

function normalizePort(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function normalizeVesselParam(value: string | null | undefined): string {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : UNKNOWN_VESSEL
}

function computeTransshipmentSemanticKey(command: {
  readonly port: string
  readonly fromVessel: string
  readonly toVessel: string
}): string {
  return [
    `port:${normalizeKeyPart(command.port)}`,
    `from:${normalizeKeyPart(command.fromVessel)}`,
    `to:${normalizeKeyPart(command.toVessel)}`,
  ].join('|')
}

function toAnchorObservationId(event: TrackingTimelineItem): string | null {
  const observationId = event.observationId?.trim() ?? ''
  if (observationId.length > 0) return observationId

  const eventId = event.id.trim()
  return eventId.length > 0 ? eventId : null
}

function toDetectedAtIso(event: TrackingTimelineItem, now: Instant): string {
  if (event.eventTime === null) return now.toIsoString()
  const temporalValue = parseTemporalValue(event.eventTime)
  if (temporalValue === null) return now.toIsoString()
  return toComparableInstant(temporalValue, TRACKING_CHRONOLOGY_COMPARE_OPTIONS).toIsoString()
}

function toAnchorObservationFingerprint(
  event: TrackingTimelineItem,
  observationById: ReadonlyMap<string, Observation>,
): string | null {
  const observationId = toAnchorObservationId(event)
  if (observationId === null) return null
  return observationById.get(observationId)?.fingerprint ?? null
}

function isPlannedTransshipmentCandidateBlock(
  block: TransshipmentBlock,
): block is PlannedTransshipmentCandidateBlock {
  return block.mode === 'planned' && block.events.length > 0
}

function toPlannedOccurrenceFromBlock(
  block: PlannedTransshipmentBlock | PlannedTransshipmentCandidateBlock,
  observationById: ReadonlyMap<string, Observation>,
  now: Instant,
): PlannedTransshipmentOccurrence | null {
  const event = block.blockType === 'planned-transshipment' ? block.event : block.events[0]
  if (event === undefined) return null

  const anchorObservationId = toAnchorObservationId(event)
  const anchorObservation =
    anchorObservationId === null ? null : (observationById.get(anchorObservationId) ?? null)

  const port =
    normalizePort(anchorObservation?.location_code) ??
    normalizePort(anchorObservation?.location_display) ??
    normalizePort(block.port) ??
    null
  if (port === null) return null

  const fromVessel = normalizeVesselParam(
    block.blockType === 'planned-transshipment' ? block.fromVessel : block.previousVesselName,
  )
  const toVessel = normalizeVesselParam(
    block.blockType === 'planned-transshipment' ? block.toVessel : block.nextVesselName,
  )
  const detectedAt = toDetectedAtIso(event, now)
  const sourceObservationFingerprint = toAnchorObservationFingerprint(event, observationById)
  const semanticKey = computeTransshipmentSemanticKey({
    port,
    fromVessel,
    toVessel,
  })
  const alertFingerprint = computeAlertFingerprint('PLANNED_TRANSSHIPMENT', [
    semanticKey,
    `detected:${detectedAt}`,
    sourceObservationFingerprint ?? `anchor:${anchorObservationId ?? event.id}`,
  ])

  return {
    port,
    fromVessel,
    toVessel,
    detectedAt,
    sourceObservationFingerprints:
      sourceObservationFingerprint === null ? [] : [sourceObservationFingerprint],
    alertFingerprint,
    semanticKey,
  }
}

function collapseDuplicateOccurrences(
  occurrences: readonly PlannedTransshipmentOccurrence[],
): readonly PlannedTransshipmentOccurrence[] {
  const byFingerprint = new Map<string, PlannedTransshipmentOccurrence>()

  for (const occurrence of occurrences) {
    if (!byFingerprint.has(occurrence.alertFingerprint)) {
      byFingerprint.set(occurrence.alertFingerprint, occurrence)
    }
  }

  return [...byFingerprint.values()].sort((left, right) => {
    const detectedAtCompare = left.detectedAt.localeCompare(right.detectedAt)
    if (detectedAtCompare !== 0) return detectedAtCompare
    return left.alertFingerprint.localeCompare(right.alertFingerprint)
  })
}

function extractPlannedBlocks(
  renderList: readonly TimelineRenderItem[],
): readonly (PlannedTransshipmentBlock | PlannedTransshipmentCandidateBlock)[] {
  const blocks: (PlannedTransshipmentBlock | PlannedTransshipmentCandidateBlock)[] = []

  for (const item of renderList) {
    if (item.type === 'planned-transshipment-block') {
      blocks.push(item.block)
      continue
    }

    if (item.type === 'transshipment-block' && isPlannedTransshipmentCandidateBlock(item.block)) {
      blocks.push(item.block)
    }
  }

  return blocks
}

function isActiveAlertState(alert: TrackingAlertDerivationState): boolean {
  return alert.acked_at === null && alert.resolved_at === null
}

function toExistingSemanticKey(alert: TrackingAlertDerivationState): string | null {
  if (alert.type !== 'PLANNED_TRANSSHIPMENT') return null
  const messageParams = alert.message_params

  if (!('port' in messageParams)) return null
  if (!('fromVessel' in messageParams)) return null
  if (!('toVessel' in messageParams)) return null

  return computeTransshipmentSemanticKey({
    port: messageParams.port,
    fromVessel: messageParams.fromVessel,
    toVessel: messageParams.toVessel,
  })
}

export function derivePlannedTransshipmentOccurrences(command: {
  readonly timelineItems: readonly TrackingTimelineItem[]
  readonly observations: readonly Observation[]
  readonly now: Instant
}): readonly PlannedTransshipmentOccurrence[] {
  const observationById = new Map(
    command.observations.map((observation) => [observation.id, observation] as const),
  )
  const renderList = buildTimelineRenderList(command.timelineItems, command.now)

  return collapseDuplicateOccurrences(
    extractPlannedBlocks(renderList)
      .map((block) => toPlannedOccurrenceFromBlock(block, observationById, command.now))
      .filter((occurrence): occurrence is PlannedTransshipmentOccurrence => occurrence !== null),
  )
}

export function derivePlannedTransshipmentAlertTransitions(command: {
  readonly timelineItems: readonly TrackingTimelineItem[]
  readonly observations: readonly Observation[]
  readonly existingAlerts: readonly TrackingAlertDerivationState[]
  readonly activeFactTransshipmentSemanticKeys: ReadonlySet<string>
  readonly now: Instant
}): PlannedTransshipmentAlertTransitions {
  const occurrences = derivePlannedTransshipmentOccurrences({
    timelineItems: command.timelineItems,
    observations: command.observations,
    now: command.now,
  })
  const occurrenceFingerprintSet = new Set(
    occurrences.map((occurrence) => occurrence.alertFingerprint),
  )
  const alertIdsToAutoResolve = command.existingAlerts
    .filter((alert) => alert.type === 'PLANNED_TRANSSHIPMENT')
    .filter(isActiveAlertState)
    .filter((alert) => {
      const currentFingerprint = alert.alert_fingerprint
      if (currentFingerprint === null || !occurrenceFingerprintSet.has(currentFingerprint)) {
        return true
      }

      const semanticKey = toExistingSemanticKey(alert)
      return semanticKey !== null && command.activeFactTransshipmentSemanticKeys.has(semanticKey)
    })
    .map((alert) => alert.id)

  return {
    occurrences,
    alertIdsToAutoResolve,
  }
}

export function toTransshipmentSemanticKey(command: {
  readonly port: string
  readonly fromVessel: string
  readonly toVessel: string
}): string {
  return computeTransshipmentSemanticKey(command)
}
