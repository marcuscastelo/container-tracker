import type {
  TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal,
  TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
  TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import {
  digestTrackingValidationFingerprint,
  normalizeTrackingValidationFingerprintPart,
} from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'

const DETECTOR_ID = 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED'
const DETECTOR_VERSION = '1'
const SUMMARY_KEY = 'tracking.validation.canonicalTimelineSegmentDuplicated'
const CRITICAL_DUPLICATED_SEGMENT_STATUSES: ReadonlySet<TrackingValidationContext['status']> =
  new Set(['LOADED', 'IN_TRANSIT', 'ARRIVED_AT_POD', 'DISCHARGED', 'AVAILABLE_FOR_PICKUP'])

function formatMilestoneLabel(
  milestone: TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal,
): string {
  return milestone.eventTimeType === 'EXPECTED' ? `${milestone.type} EXPECTED` : milestone.type
}

function compareMilestones(
  left: TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal,
  right: TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal,
): number {
  const priority = new Map([
    ['DISCHARGE', 0],
    ['ARRIVAL', 1],
    ['LOAD', 2],
    ['DEPARTURE', 3],
  ])

  const typeCompare = (priority.get(left.type) ?? 99) - (priority.get(right.type) ?? 99)
  if (typeCompare !== 0) {
    return typeCompare
  }

  if (left.eventTimeType !== right.eventTimeType) {
    return left.eventTimeType === 'ACTUAL' ? -1 : 1
  }

  return left.location.localeCompare(right.location, 'en')
}

function describeAffectedLocation(
  signal: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
): string | null {
  const milestone = [...signal.repeatedMilestones].sort(compareMilestones)[0]
  return milestone?.location ?? null
}

function describeEvidence(
  signal: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
): string {
  const duplicatedMilestones = [...new Set(signal.repeatedMilestones.map(formatMilestoneLabel))]
  const milestoneLabel =
    duplicatedMilestones.length <= 2
      ? duplicatedMilestones.join(' and ')
      : `${duplicatedMilestones.slice(0, 2).join(', ')} +${duplicatedMilestones.length - 2}`
  const blockOrders = signal.blocks.map((block) => block.order).join(' and ')

  return `Timeline repeats ${signal.vessel} / ${signal.voyage} across blocks ${blockOrders} with duplicated ${milestoneLabel}.`
}

function toSeverity(
  signal: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
  status: TrackingValidationContext['status'],
): TrackingValidationFinding['severity'] {
  return signal.includesLatestVoyageBlock && CRITICAL_DUPLICATED_SEGMENT_STATUSES.has(status)
    ? 'CRITICAL'
    : 'ADVISORY'
}

function buildStateFingerprint(
  signal: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
): string {
  const blockParts = signal.blocks.map((block) =>
    [
      block.order.toString(),
      normalizeTrackingValidationFingerprintPart(block.origin),
      normalizeTrackingValidationFingerprintPart(block.destination),
      block.timelineItemIds.join(','),
    ].join(':'),
  )
  const milestoneParts = signal.repeatedMilestones.map((milestone) =>
    [
      milestone.type,
      milestone.eventTimeType,
      normalizeTrackingValidationFingerprintPart(milestone.location),
      milestone.timelineItemIds.join(','),
    ].join(':'),
  )

  return digestTrackingValidationFingerprint([
    signal.identityKey,
    ...blockParts.sort(),
    ...milestoneParts.sort(),
  ])
}

function createFinding(
  containerId: string,
  signal: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
  status: TrackingValidationContext['status'],
): TrackingValidationFinding {
  return {
    detectorId: DETECTOR_ID,
    detectorVersion: DETECTOR_VERSION,
    code: DETECTOR_ID,
    lifecycleKey: `${DETECTOR_ID}:${containerId}:${signal.identityKey}`,
    stateFingerprint: buildStateFingerprint(signal),
    severity: toSeverity(signal, status),
    affectedScope: 'TIMELINE',
    summaryKey: SUMMARY_KEY,
    affectedLocation: describeAffectedLocation(signal),
    affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
    evidenceSummary: describeEvidence(signal),
    debugEvidence: {
      vessel: signal.vessel,
      voyage: signal.voyage,
      duplicatedBlockCount: signal.blocks.length,
      blockOrders: signal.blocks.map((block) => block.order).join(','),
      repeatedMilestones: signal.repeatedMilestones
        .map((milestone) =>
          [
            milestone.type,
            milestone.eventTimeType,
            normalizeTrackingValidationFingerprintPart(milestone.location),
          ].join(':'),
        )
        .join(','),
      timelineItemIds: signal.repeatedMilestones
        .flatMap((milestone) => milestone.timelineItemIds)
        .join(','),
      includesLatestVoyageBlock: signal.includesLatestVoyageBlock,
    },
    isActive: true,
  }
}

export const canonicalTimelineSegmentDuplicatedDetector: TrackingValidationDetector = {
  id: DETECTOR_ID,
  version: DETECTOR_VERSION,
  detect(context): readonly TrackingValidationFinding[] {
    return context.derivedSignals.canonicalTimeline.duplicatedSegments.map((signal) =>
      createFinding(context.containerId, signal, context.status),
    )
  },
}
