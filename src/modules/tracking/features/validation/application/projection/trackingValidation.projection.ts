import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import {
  buildTimelineRenderList,
  type TimelineRenderItem,
  type VoyageBlock,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import {
  compareTrackingValidationDisplayIssues,
  type TrackingValidationDisplayIssue,
  toTrackingValidationAffectedArea,
} from '~/modules/tracking/features/validation/application/projection/trackingValidationDisplayIssue'
import { TRACKING_VALIDATION_DETECTORS } from '~/modules/tracking/features/validation/domain/detectors'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationCanonicalTimelineDuplicatedMilestoneType,
  type TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal,
  type TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
  type TrackingValidationContext,
  type TrackingValidationDetectorSignals,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationFinding } from '~/modules/tracking/features/validation/domain/model/trackingValidationFinding'
import type {
  TrackingValidationContainerSummary as TrackingValidationContainerSummaryModel,
  TrackingValidationProcessSummary as TrackingValidationProcessSummaryModel,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import {
  createEmptyTrackingValidationContainerSummary as createEmptyTrackingValidationContainerSummaryModel,
  createEmptyTrackingValidationProcessSummary as createEmptyTrackingValidationProcessSummaryModel,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationSummary'
import { createTrackingValidationRegistry } from '~/modules/tracking/features/validation/domain/registry/trackingValidationRegistry'
import { aggregateTrackingValidation } from '~/modules/tracking/features/validation/domain/services/aggregateTrackingValidation'
import { deriveTrackingValidation } from '~/modules/tracking/features/validation/domain/services/deriveTrackingValidation'
import { normalizeTrackingValidationFingerprintPart } from '~/modules/tracking/features/validation/domain/services/trackingValidationFingerprint'
import type { Instant } from '~/shared/time/instant'

const trackingValidationRegistry = createTrackingValidationRegistry(TRACKING_VALIDATION_DETECTORS)

export type TrackingValidationContainerSummary = TrackingValidationContainerSummaryModel & {
  readonly activeIssues: readonly TrackingValidationDisplayIssue[]
  readonly topIssue: TrackingValidationDisplayIssue | null
}

export type TrackingValidationProcessSummary = TrackingValidationProcessSummaryModel

export type TrackingValidationProjectionInput = {
  readonly containerId: string
  readonly containerNumber: string
  readonly observations: readonly Observation[]
  readonly timeline: Timeline
  readonly status: ContainerStatus
  readonly transshipment: TransshipmentInfo
  readonly now: Instant
}

export type TrackingValidationContainerProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly findings: readonly TrackingValidationFinding[]
  readonly summary: TrackingValidationContainerSummary
}

type TrackingValidationTopIssueCandidate = {
  readonly containerNumber: string
  readonly topIssue: TrackingValidationDisplayIssue | null
}

type DuplicatedMilestoneCandidate = {
  readonly signature: string
  readonly type: TrackingValidationCanonicalTimelineDuplicatedMilestoneType
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly location: string
  readonly timelineItemId: string
}

type DuplicatedVoyageBlockCandidate = {
  readonly order: number
  readonly vessel: string
  readonly voyage: string
  readonly normalizedVessel: string
  readonly normalizedVoyage: string
  readonly origin: string | null
  readonly normalizedOrigin: string | null
  readonly destination: string | null
  readonly timelineItemIds: readonly string[]
  readonly milestonesBySignature: ReadonlyMap<string, DuplicatedMilestoneCandidate>
}

function isNonNullRepeatedMilestone(
  milestone: TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal | null,
): milestone is TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal {
  return milestone !== null
}

function toTrackingValidationDisplayIssue(
  finding: TrackingValidationFinding,
): TrackingValidationDisplayIssue {
  return {
    code: finding.code,
    severity: finding.severity,
    reasonKey: finding.summaryKey,
    affectedArea: toTrackingValidationAffectedArea(finding.affectedScope),
    affectedLocation: finding.affectedLocation,
    affectedBlockLabelKey: finding.affectedBlockLabelKey,
  }
}

function toActiveIssues(
  findings: readonly TrackingValidationFinding[],
): readonly TrackingValidationDisplayIssue[] {
  return findings
    .filter((finding) => finding.isActive)
    .map(toTrackingValidationDisplayIssue)
    .sort(compareTrackingValidationDisplayIssues)
}

function toContainerSummary(
  summary: TrackingValidationContainerSummaryModel,
  activeIssues: readonly TrackingValidationDisplayIssue[],
): TrackingValidationContainerSummary {
  return {
    ...summary,
    activeIssues,
    topIssue: activeIssues[0] ?? null,
  }
}

function compareTopIssueCandidates(
  left: TrackingValidationTopIssueCandidate,
  right: TrackingValidationTopIssueCandidate,
): number {
  if (left.topIssue === null) {
    return right.topIssue === null ? 0 : 1
  }
  if (right.topIssue === null) {
    return -1
  }

  const issueCompare = compareTrackingValidationDisplayIssues(left.topIssue, right.topIssue)
  if (issueCompare !== 0) {
    return issueCompare
  }

  return left.containerNumber.localeCompare(right.containerNumber, 'en')
}

function normalizeVoyageIdentity(voyage: string | null | undefined): string | null {
  const normalizedVoyage = normalizeTrackingValidationFingerprintPart(voyage)
  return normalizedVoyage.length > 0 ? normalizedVoyage : null
}

function normalizeDisplayLocation(location: string | null | undefined): string | null {
  const normalizedLocation = normalizeTrackingValidationFingerprintPart(location)
  return normalizedLocation.length > 0 ? normalizedLocation : null
}

function isDuplicatedSegmentMilestoneType(
  type: TrackingTimelineItem['type'],
): type is TrackingValidationCanonicalTimelineDuplicatedMilestoneType {
  return type === 'LOAD' || type === 'DEPARTURE' || type === 'ARRIVAL' || type === 'DISCHARGE'
}

function buildDuplicatedMilestoneCandidate(
  event: TrackingTimelineItem,
): DuplicatedMilestoneCandidate | null {
  if (!isDuplicatedSegmentMilestoneType(event.type)) {
    return null
  }

  const normalizedLocation = normalizeDisplayLocation(event.location ?? null)
  if (normalizedLocation === null) {
    return null
  }

  return {
    signature: [event.type, event.eventTimeType, normalizedLocation].join(':'),
    type: event.type,
    eventTimeType: event.eventTimeType,
    location: event.location ?? normalizedLocation,
    timelineItemId: event.id,
  }
}

function buildDuplicatedVoyageBlockCandidate(
  block: VoyageBlock,
  order: number,
): DuplicatedVoyageBlockCandidate | null {
  const normalizedVessel = normalizeVesselName(block.vessel)
  const normalizedVoyage = normalizeVoyageIdentity(block.voyage)
  if (normalizedVessel === null || normalizedVoyage === null) {
    return null
  }

  const milestonesBySignature = new Map<string, DuplicatedMilestoneCandidate>()
  for (const event of block.events) {
    const milestone = buildDuplicatedMilestoneCandidate(event)
    if (milestone !== null && !milestonesBySignature.has(milestone.signature)) {
      milestonesBySignature.set(milestone.signature, milestone)
    }
  }

  if (milestonesBySignature.size === 0) {
    return null
  }

  return {
    order,
    vessel: block.vessel ?? normalizedVessel,
    voyage: block.voyage ?? normalizedVoyage,
    normalizedVessel,
    normalizedVoyage,
    origin: block.origin,
    normalizedOrigin: normalizeDisplayLocation(block.origin),
    destination: block.destination,
    timelineItemIds: block.events.map((event) => event.id),
    milestonesBySignature,
  }
}

function buildDuplicatedVoyageBlockCandidates(
  renderList: readonly TimelineRenderItem[],
): readonly DuplicatedVoyageBlockCandidate[] {
  const candidates: DuplicatedVoyageBlockCandidate[] = []
  let order = 0

  for (const item of renderList) {
    if (item.type !== 'voyage-block') {
      continue
    }

    order += 1
    const candidate = buildDuplicatedVoyageBlockCandidate(item.block, order)
    if (candidate !== null) {
      candidates.push(candidate)
    }
  }

  return candidates
}

function haveCompatibleOrigins(
  left: DuplicatedVoyageBlockCandidate,
  right: DuplicatedVoyageBlockCandidate,
): boolean {
  return (
    left.normalizedOrigin === null ||
    right.normalizedOrigin === null ||
    left.normalizedOrigin === right.normalizedOrigin
  )
}

function sharedMilestoneSignatures(
  left: DuplicatedVoyageBlockCandidate,
  right: DuplicatedVoyageBlockCandidate,
): readonly string[] {
  const shared: string[] = []

  for (const signature of left.milestonesBySignature.keys()) {
    if (right.milestonesBySignature.has(signature)) {
      shared.push(signature)
    }
  }

  return shared
}

function collectDuplicatedSegmentSignalsForGroup(
  blocks: readonly DuplicatedVoyageBlockCandidate[],
  lastVoyageOrder: number,
): readonly TrackingValidationCanonicalTimelineSegmentDuplicatedSignal[] {
  if (blocks.length < 2) {
    return []
  }

  const blockByOrder = new Map(blocks.map((block) => [block.order, block]))
  const adjacency = new Map<number, Set<number>>()
  const repeatedSignaturesByOrder = new Map<number, Set<string>>()

  for (const block of blocks) {
    adjacency.set(block.order, new Set())
    repeatedSignaturesByOrder.set(block.order, new Set())
  }

  for (let index = 0; index < blocks.length - 1; index++) {
    const left = blocks[index]
    if (left === undefined) continue

    for (let compareIndex = index + 1; compareIndex < blocks.length; compareIndex++) {
      const right = blocks[compareIndex]
      if (right === undefined || !haveCompatibleOrigins(left, right)) {
        continue
      }

      const shared = sharedMilestoneSignatures(left, right)
      if (shared.length === 0) {
        continue
      }

      adjacency.get(left.order)?.add(right.order)
      adjacency.get(right.order)?.add(left.order)

      const leftSignatures = repeatedSignaturesByOrder.get(left.order)
      const rightSignatures = repeatedSignaturesByOrder.get(right.order)
      if (leftSignatures !== undefined) {
        for (const signature of shared) leftSignatures.add(signature)
      }
      if (rightSignatures !== undefined) {
        for (const signature of shared) rightSignatures.add(signature)
      }
    }
  }

  const visited = new Set<number>()
  const signals: TrackingValidationCanonicalTimelineSegmentDuplicatedSignal[] = []

  for (const block of blocks) {
    if (visited.has(block.order)) {
      continue
    }

    const queue = [block.order]
    const componentOrders: number[] = []

    while (queue.length > 0) {
      const currentOrder = queue.shift()
      if (currentOrder === undefined || visited.has(currentOrder)) {
        continue
      }

      visited.add(currentOrder)
      componentOrders.push(currentOrder)

      const neighbors = adjacency.get(currentOrder)
      if (neighbors === undefined) {
        continue
      }

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor)
        }
      }
    }

    if (componentOrders.length < 2) {
      continue
    }

    const componentBlocks = componentOrders
      .map((order) => blockByOrder.get(order))
      .filter((candidate): candidate is DuplicatedVoyageBlockCandidate => candidate !== undefined)
      .sort((left, right) => left.order - right.order)

    if (componentBlocks.length < 2) {
      continue
    }

    const componentSignatures = new Set<string>()
    for (const componentBlock of componentBlocks) {
      const signatures = repeatedSignaturesByOrder.get(componentBlock.order)
      if (signatures === undefined) continue
      for (const signature of signatures) {
        componentSignatures.add(signature)
      }
    }

    if (componentSignatures.size === 0) {
      continue
    }

    const repeatedMilestones = [...componentSignatures]
      .map(
        (signature): TrackingValidationCanonicalTimelineSegmentDuplicatedMilestoneSignal | null => {
          let representative: DuplicatedMilestoneCandidate | null = null
          const timelineItemIds: string[] = []

          for (const componentBlock of componentBlocks) {
            const milestone = componentBlock.milestonesBySignature.get(signature)
            if (milestone === undefined) {
              continue
            }
            if (representative === null) {
              representative = milestone
            }
            timelineItemIds.push(milestone.timelineItemId)
          }

          if (representative === null || timelineItemIds.length < 2) {
            return null
          }

          return {
            type: representative.type,
            eventTimeType: representative.eventTimeType,
            location: representative.location,
            timelineItemIds,
          }
        },
      )
      .filter(isNonNullRepeatedMilestone)
      .sort((left, right) => left.type.localeCompare(right.type, 'en'))

    if (repeatedMilestones.length === 0) {
      continue
    }

    const knownOrigins = [
      ...new Set(
        componentBlocks
          .map((componentBlock) => componentBlock.normalizedOrigin)
          .filter((origin): origin is string => origin !== null),
      ),
    ].sort()
    const repeatedLocations = [
      ...new Set(repeatedMilestones.map((milestone) => milestone.location)),
    ]
      .map((location) => normalizeDisplayLocation(location))
      .filter((location): location is string => location !== null)
      .sort()
    const identitySuffix =
      knownOrigins.length > 0 ? knownOrigins.join('+') : (repeatedLocations[0] ?? 'UNKNOWN')

    signals.push({
      vessel: componentBlocks[0]?.vessel ?? blocks[0]?.vessel ?? 'UNKNOWN',
      voyage: componentBlocks[0]?.voyage ?? blocks[0]?.voyage ?? 'UNKNOWN',
      identityKey: [
        componentBlocks[0]?.normalizedVessel ?? 'UNKNOWN',
        componentBlocks[0]?.normalizedVoyage ?? 'UNKNOWN',
        identitySuffix,
      ].join('|'),
      blocks: componentBlocks.map((componentBlock) => ({
        order: componentBlock.order,
        origin: componentBlock.origin,
        destination: componentBlock.destination,
        timelineItemIds: componentBlock.timelineItemIds,
      })),
      repeatedMilestones,
      includesLatestVoyageBlock: componentBlocks.some(
        (componentBlock) => componentBlock.order === lastVoyageOrder,
      ),
    })
  }

  return signals
}

function deriveDuplicatedSegmentSignals(
  renderList: readonly TimelineRenderItem[],
): readonly TrackingValidationCanonicalTimelineSegmentDuplicatedSignal[] {
  const blockCandidates = buildDuplicatedVoyageBlockCandidates(renderList)
  if (blockCandidates.length < 2) {
    return []
  }

  const lastVoyageOrder = blockCandidates[blockCandidates.length - 1]?.order ?? 0
  const blocksByIdentity = new Map<string, DuplicatedVoyageBlockCandidate[]>()

  for (const blockCandidate of blockCandidates) {
    const identityKey = `${blockCandidate.normalizedVessel}|${blockCandidate.normalizedVoyage}`
    const group = blocksByIdentity.get(identityKey)
    if (group === undefined) {
      blocksByIdentity.set(identityKey, [blockCandidate])
    } else {
      group.push(blockCandidate)
    }
  }

  return [...blocksByIdentity.values()]
    .flatMap((group) => collectDuplicatedSegmentSignalsForGroup(group, lastVoyageOrder))
    .sort((left, right) => {
      const leftOrder = left.blocks[0]?.order ?? 0
      const rightOrder = right.blocks[0]?.order ?? 0
      return leftOrder - rightOrder
    })
}

function deriveTrackingValidationDetectorSignals(
  context: TrackingValidationProjectionInput,
): TrackingValidationDetectorSignals {
  const timelineItems = deriveTimelineWithSeriesReadModel(
    toTrackingObservationProjections(context.observations),
    context.now,
    { includeSeriesHistory: false },
  )
  const renderList = buildTimelineRenderList(timelineItems, context.now)
  const postCarriageMaritimeEvents = renderList.flatMap((item) => {
    if (item.type !== 'terminal-block' || item.block.kind !== 'post-carriage') {
      return []
    }

    return item.block.events.flatMap((event) => {
      const hasVesselContext = (event.vesselName?.trim().length ?? 0) > 0
      const hasVoyageContext = (event.voyage?.trim().length ?? 0) > 0
      const hasStrongMaritimeType = event.type === 'LOAD' || event.type === 'DEPARTURE'

      if (!hasVesselContext && !hasVoyageContext && !hasStrongMaritimeType) {
        return []
      }

      return [
        {
          type: event.type,
          eventTimeType: event.eventTimeType,
          location: event.location ?? null,
          hasVesselContext,
          hasVoyageContext,
        },
      ]
    })
  })
  const duplicatedSegments = deriveDuplicatedSegmentSignals(renderList)

  if (postCarriageMaritimeEvents.length === 0 && duplicatedSegments.length === 0) {
    return createEmptyTrackingValidationDetectorSignals()
  }

  return {
    canonicalTimeline: {
      postCarriageMaritimeEvents,
      duplicatedSegments,
    },
  }
}

export function createTrackingValidationContext(
  context: TrackingValidationProjectionInput,
): TrackingValidationContext {
  return {
    ...context,
    derivedSignals: deriveTrackingValidationDetectorSignals(context),
  }
}

function deriveTrackingValidationProjectionFromInput(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerProjection {
  return deriveTrackingValidationProjection(createTrackingValidationContext(context))
}

export function deriveTrackingValidationProjectionFromState(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerProjection {
  return deriveTrackingValidationProjectionFromInput(context)
}

export function deriveTrackingValidationSummaryFromState(
  context: TrackingValidationProjectionInput,
): TrackingValidationContainerSummary {
  return deriveTrackingValidationProjectionFromInput(context).summary
}

export function deriveTrackingValidationProjection(
  context: TrackingValidationContext,
): TrackingValidationContainerProjection {
  const derivation = deriveTrackingValidation({
    context,
    registry: trackingValidationRegistry,
  })
  const activeIssues = toActiveIssues(derivation.findings)

  return {
    containerId: context.containerId,
    containerNumber: context.containerNumber,
    findings: derivation.findings,
    summary: toContainerSummary(derivation.summary, activeIssues),
  }
}

export function aggregateTrackingValidationProjection(
  summaries: readonly TrackingValidationContainerSummary[],
): TrackingValidationProcessSummary {
  return aggregateTrackingValidation(summaries)
}

export function pickTopTrackingValidationIssueForProcess(
  candidates: readonly TrackingValidationTopIssueCandidate[],
): TrackingValidationDisplayIssue | null {
  const sortedCandidates = [...candidates].sort(compareTopIssueCandidates)

  return sortedCandidates[0]?.topIssue ?? null
}

export function createEmptyTrackingValidationContainerProjectionSummary(): TrackingValidationContainerSummary {
  return {
    ...createEmptyTrackingValidationContainerSummaryModel(),
    activeIssues: [],
    topIssue: null,
  }
}

export function createEmptyTrackingValidationProcessProjectionSummary(): TrackingValidationProcessSummary {
  return createEmptyTrackingValidationProcessSummaryModel()
}
