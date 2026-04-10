import {
  groupVoyageSegments,
  type VoyageSegment,
} from '~/modules/tracking/application/projection/voyageSegments'
import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { systemClock } from '~/shared/time/clock'
import { toComparableInstant } from '~/shared/time/compare-temporal'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'
import { parseTemporalValue } from '~/shared/time/parsing'

export type TerminalSegmentKind = 'pre-carriage' | 'transshipment-terminal' | 'post-carriage'

type TerminalSegment = {
  readonly id: string
  readonly kind: TerminalSegmentKind
  readonly title: string
  readonly location: string | null
  readonly events: readonly TrackingTimelineItem[]
}

function isVoyageLikeSegment(segment: VoyageSegment): boolean {
  return segment.plannedContinuation || segment.vessel !== null || segment.voyage !== null
}

function findNextVoyageLikeSegment<TSegment extends VoyageSegment>(
  voyageSegments: readonly TSegment[],
  currentIndex: number,
): { readonly index: number; readonly segment: TSegment } | null {
  for (let index = currentIndex + 1; index < voyageSegments.length; index++) {
    const candidate = voyageSegments[index]
    if (candidate !== undefined && isVoyageLikeSegment(candidate)) {
      return { index, segment: candidate }
    }
  }

  return null
}

function findPreviousVoyageLikeSegment<TSegment extends VoyageSegment>(
  voyageSegments: readonly TSegment[],
  currentIndex: number,
): { readonly index: number; readonly segment: TSegment } | null {
  for (let index = currentIndex - 1; index >= 0; index--) {
    const candidate = voyageSegments[index]
    if (candidate !== undefined && isVoyageLikeSegment(candidate)) {
      return { index, segment: candidate }
    }
  }

  return null
}

/**
 * Identify a single dominant location from a set of events (mode).
 * Returns null when no events carry location info.
 */
function dominantLocation(events: readonly TrackingTimelineItem[]): string | null {
  const counts = new Map<string, number>()
  for (const e of events) {
    if (e.location) {
      counts.set(e.location, (counts.get(e.location) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  let best: string | null = null
  let bestCount = 0
  for (const [loc, count] of counts) {
    if (count > bestCount) {
      best = loc
      bestCount = count
    }
  }
  return best
}

function terminalSegmentTitle(kind: TerminalSegmentKind): string {
  if (kind === 'pre-carriage') return 'Pre-carriage'
  if (kind === 'transshipment-terminal') return 'Transshipment Terminal'
  return 'Post-carriage / Delivery'
}

function terminalSegmentId(events: readonly TrackingTimelineItem[]): string {
  const first = events[0]
  const last = events[events.length - 1]

  return `${first?.id ?? 'terminal'}:${last?.id ?? 'terminal'}`
}

function pushTerminalSegment(
  segments: TerminalSegment[],
  runPosition: 'before' | 'between' | 'after',
  events: readonly TrackingTimelineItem[],
): void {
  if (events.length === 0) return

  let kind: TerminalSegmentKind
  if (runPosition === 'before') kind = 'pre-carriage'
  else if (runPosition === 'after') kind = 'post-carriage'
  else kind = 'transshipment-terminal'

  segments.push({
    id: terminalSegmentId(events),
    kind,
    title: terminalSegmentTitle(kind),
    location: dominantLocation(events),
    events,
  })
}

function shouldSplitTerminalRunByLocation(
  runPosition: 'before' | 'between' | 'after',
  currentRun: readonly TrackingTimelineItem[],
  nextEvent: TrackingTimelineItem,
): boolean {
  if (runPosition !== 'between' || currentRun.length === 0) return false

  let lastKnownLocation: string | null = null
  for (let index = currentRun.length - 1; index >= 0; index--) {
    const event = currentRun[index]
    if (event?.location) {
      lastKnownLocation = event.location
      break
    }
  }

  return lastKnownLocation !== null &&
    nextEvent.location !== undefined &&
    nextEvent.location !== null
    ? lastKnownLocation !== nextEvent.location
    : false
}

const EVENT_TIE_BREAK_PRIORITY = new Map<string, number>([
  ['GATE_OUT', 10],
  ['GATE_IN', 20],
  ['ARRIVAL', 30],
  ['DISCHARGE', 40],
  ['TRANSSHIPMENT_INTENDED', 50],
  ['TRANSSHIPMENT_POSITIONED_IN', 60],
  ['TERMINAL_MOVE', 70],
  ['TRANSSHIPMENT_POSITIONED_OUT', 80],
  ['LOAD', 90],
  ['DEPARTURE', 100],
  ['DELIVERY', 110],
  ['EMPTY_RETURN', 120],
])

const DEFAULT_EVENT_TIE_BREAK_PRIORITY = 500

function compareTextValue(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const normalizedLeft = left ?? ''
  const normalizedRight = right ?? ''

  if (normalizedLeft < normalizedRight) return -1
  if (normalizedLeft > normalizedRight) return 1
  return 0
}

function eventTieBreakPriority(type: string): number {
  return EVENT_TIE_BREAK_PRIORITY.get(type) ?? DEFAULT_EVENT_TIE_BREAK_PRIORITY
}

function compareTimelineItemsForBlockDerivation(
  left: TrackingTimelineItem,
  right: TrackingTimelineItem,
): number {
  const leftInstant = toTimelineInstant(left.eventTime)
  const rightInstant = toTimelineInstant(right.eventTime)

  if (leftInstant === null && rightInstant !== null) return 1
  if (leftInstant !== null && rightInstant === null) return -1

  if (leftInstant !== null && rightInstant !== null) {
    const timeCompare = leftInstant.compare(rightInstant)
    if (timeCompare !== 0) return timeCompare
  }

  if (left.eventTimeType === 'ACTUAL' && right.eventTimeType === 'EXPECTED') return -1
  if (left.eventTimeType === 'EXPECTED' && right.eventTimeType === 'ACTUAL') return 1

  const priorityCompare = eventTieBreakPriority(left.type) - eventTieBreakPriority(right.type)
  if (priorityCompare !== 0) return priorityCompare

  const typeCompare = compareTextValue(left.type, right.type)
  if (typeCompare !== 0) return typeCompare

  const locationCompare = compareTextValue(left.location, right.location)
  if (locationCompare !== 0) return locationCompare

  const vesselCompare = compareTextValue(left.vesselName, right.vesselName)
  if (vesselCompare !== 0) return vesselCompare

  const voyageCompare = compareTextValue(left.voyage, right.voyage)
  if (voyageCompare !== 0) return voyageCompare

  return compareTextValue(left.id, right.id)
}

/**
 * Timeline block classification depends on the relative order of timeline items.
 * Providers that emit date-only milestones can collapse multiple transshipment
 * steps onto the same comparable instant, so we apply a semantic tie-break here
 * to keep those helper events stable and prevent them from drifting into
 * post-carriage because of incidental array order.
 */
function sortTimelineItemsForBlockDerivation(
  events: readonly TrackingTimelineItem[],
): readonly TrackingTimelineItem[] {
  if (events.length < 2) return events
  return [...events].sort(compareTimelineItemsForBlockDerivation)
}

/**
 * Group events that do NOT belong to any voyage segment into terminal segments.
 *
 * - Events before the first voyage → "pre-carriage"
 * - Events between voyages → "transshipment-terminal"
 * - Events after the last voyage → "post-carriage"
 */
function groupTerminalSegments(
  events: readonly TrackingTimelineItem[],
  voyageSegments: readonly VoyageSegment[],
): readonly TerminalSegment[] {
  // Build a set of event IDs that belong to voyages
  const voyageEventIds = new Set<string>()
  for (const seg of voyageSegments) {
    if (isVoyageLikeSegment(seg)) {
      for (const e of seg.events) voyageEventIds.add(e.id)
    }
  }

  // Collect runs of non-voyage events preserving order
  const segments: TerminalSegment[] = []
  let currentRun: TrackingTimelineItem[] = []
  let firstVoyageIdx = -1
  let lastVoyageIdx = -1

  // Find first and last voyage event indices among original events
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event !== undefined && voyageEventIds.has(event.id)) {
      if (firstVoyageIdx === -1) firstVoyageIdx = i
      lastVoyageIdx = i
    }
  }

  let runPosition: 'before' | 'between' | 'after' = 'before'

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event === undefined) continue

    if (voyageEventIds.has(event.id)) {
      // Flush any accumulated terminal events
      if (currentRun.length > 0) {
        pushTerminalSegment(segments, runPosition, currentRun)
        currentRun = []
      }
      // After the first voyage event, the run position switches
      if (i >= lastVoyageIdx) {
        runPosition = 'after'
      } else {
        runPosition = 'between'
      }
    } else {
      if (shouldSplitTerminalRunByLocation(runPosition, currentRun, event)) {
        pushTerminalSegment(segments, runPosition, currentRun)
        currentRun = []
      }
      currentRun.push(event)
    }
  }

  // Flush remaining terminal events
  if (currentRun.length > 0) {
    pushTerminalSegment(segments, firstVoyageIdx === -1 ? 'before' : 'after', currentRun)
  }

  return segments
}

// ---------------------------------------------------------------------------
// Phase 4 — Unified Block Model
// ---------------------------------------------------------------------------

export type VoyageBlock = {
  readonly blockType: 'voyage'
  readonly vessel: string | null
  readonly voyage: string | null
  readonly origin: string | null
  readonly destination: string | null
  readonly events: readonly TrackingTimelineItem[]
}

export type TerminalBlock = {
  readonly blockType: 'terminal'
  readonly kind: TerminalSegmentKind
  readonly title: string
  readonly location: string | null
  readonly events: readonly TrackingTimelineItem[]
}

export type HandoffDisplayMode = 'FULL' | 'NEXT_ONLY' | 'NONE'

export type TransshipmentBlock = {
  readonly blockType: 'transshipment'
  readonly mode: 'confirmed' | 'planned'
  readonly port: string | null
  readonly reason: string | null
  readonly previousVesselName: string | null
  readonly previousVoyage: string | null
  readonly nextVesselName: string | null
  readonly nextVoyage: string | null
  readonly handoffDisplayMode: HandoffDisplayMode
  readonly events: readonly TrackingTimelineItem[]
}

export type PlannedTransshipmentBlock = {
  readonly blockType: 'planned-transshipment'
  readonly port: string | null
  readonly event: TrackingTimelineItem
  readonly fromVessel: string | null
  readonly fromVoyage: string | null
  readonly toVessel: string | null
  readonly toVoyage: string | null
}

export type GapMarker = {
  readonly blockType: 'gap-marker'
  readonly kind: 'transit' | 'generic'
  readonly durationDays: number
  readonly fromEventType: string
  readonly toEventType: string
}

export type PortRiskMarker = {
  readonly blockType: 'port-risk-marker'
  readonly durationDays: number
  readonly ongoing: boolean
  readonly severity: 'info' | 'warning' | 'danger'
}

type ResolvedVoyageSegment = VoyageSegment & {
  readonly displayVessel: string | null
  readonly displayVoyage: string | null
  readonly legKey: string | null
}

type PlannedHandoffCandidate = {
  readonly legKey: string
  readonly port: string
  readonly destination: string
  readonly nextVesselName: string | null
  readonly nextVoyage: string | null
  readonly event: TrackingTimelineItem
}

function toOptionalDisplayValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function hasVesselOrVoyageIdentity(
  vesselName: string | null | undefined,
  voyage: string | null | undefined,
): boolean {
  return toOptionalDisplayValue(vesselName) !== null || toOptionalDisplayValue(voyage) !== null
}

function handoffDisplayMode(
  previousVesselName: string | null,
  nextVesselName: string | null,
): HandoffDisplayMode {
  if (previousVesselName !== null && nextVesselName !== null) {
    return 'FULL'
  }
  if (nextVesselName !== null) {
    return 'NEXT_ONLY'
  }
  return 'NONE'
}

function createTransshipmentBlock(params: {
  readonly mode: 'confirmed' | 'planned'
  readonly port: string | null
  readonly reason: string | null
  readonly previousVesselName: string | null
  readonly previousVoyage: string | null
  readonly nextVesselName: string | null
  readonly nextVoyage: string | null
  readonly events: readonly TrackingTimelineItem[]
}): TransshipmentBlock {
  return {
    blockType: 'transshipment',
    mode: params.mode,
    port: params.port,
    reason: params.reason,
    previousVesselName: params.previousVesselName,
    previousVoyage: params.previousVoyage,
    nextVesselName: params.nextVesselName,
    nextVoyage: params.nextVoyage,
    handoffDisplayMode: handoffDisplayMode(params.previousVesselName, params.nextVesselName),
    events: params.events,
  }
}

function legKeyFor(origin: string | null, destination: string | null): string | null {
  if (origin === null || destination === null) {
    return null
  }

  return `${origin}->${destination}`
}

function findPlannedContinuationDestination(
  events: readonly TrackingTimelineItem[],
  startIndex: number,
): string | null {
  const anchor = events[startIndex]
  const origin = anchor?.location ?? null
  if (origin === null) {
    return null
  }

  for (let index = startIndex + 1; index < events.length; index++) {
    const candidate = events[index]
    if (candidate === undefined) continue

    if (candidate.type !== 'ARRIVAL' && candidate.type !== 'DISCHARGE') {
      continue
    }

    const location = candidate.location ?? null
    if (location !== null && location !== origin) {
      return location
    }
  }

  return null
}

function isStrongerPlannedHandoffCandidate(
  candidate: PlannedHandoffCandidate,
  current: PlannedHandoffCandidate,
): boolean {
  const candidateHasIdentity = hasVesselOrVoyageIdentity(
    candidate.nextVesselName,
    candidate.nextVoyage,
  )
  const currentHasIdentity = hasVesselOrVoyageIdentity(current.nextVesselName, current.nextVoyage)

  if (candidateHasIdentity !== currentHasIdentity) {
    return candidateHasIdentity
  }

  const candidateInstant = toTimelineInstant(candidate.event.eventTime)
  const currentInstant = toTimelineInstant(current.event.eventTime)

  if (candidateInstant !== null && currentInstant !== null) {
    const compare = candidateInstant.compare(currentInstant)
    if (compare !== 0) {
      return compare > 0
    }
  } else if (candidateInstant !== null || currentInstant !== null) {
    return candidateInstant !== null
  }

  return compareTimelineItemsForBlockDerivation(candidate.event, current.event) > 0
}

type ConfirmedTransshipmentDetection = {
  readonly afterVoyageIndex: number
  readonly port: string | null
  readonly reason: string
  readonly previousVesselName: string | null
  readonly previousVoyage: string | null
  readonly nextVesselName: string | null
  readonly nextVoyage: string | null
}

function resolveDominantPlannedHandoffCandidates(
  events: readonly TrackingTimelineItem[],
): ReadonlyMap<string, PlannedHandoffCandidate> {
  const candidates = new Map<string, PlannedHandoffCandidate>()

  for (let index = 0; index < events.length; index++) {
    const event = events[index]
    if (
      event === undefined ||
      event.type !== 'TRANSSHIPMENT_INTENDED' ||
      event.eventTimeType !== 'EXPECTED'
    ) {
      continue
    }

    const port = event.location ?? null
    if (port === null) continue

    const destination = findPlannedContinuationDestination(events, index)
    const legKey = legKeyFor(port, destination)
    if (destination === null || legKey === null) continue

    const candidate: PlannedHandoffCandidate = {
      legKey,
      port,
      destination,
      nextVesselName: toOptionalDisplayValue(event.vesselName),
      nextVoyage: toOptionalDisplayValue(event.voyage),
      event,
    }

    const current = candidates.get(legKey)
    if (current === undefined || isStrongerPlannedHandoffCandidate(candidate, current)) {
      candidates.set(legKey, candidate)
    }
  }

  return candidates
}

function resolveSegmentDisplayIdentity(
  segment: VoyageSegment,
  dominantCandidate: PlannedHandoffCandidate | undefined,
): { readonly vessel: string | null; readonly voyage: string | null } {
  if (!segment.plannedContinuation) {
    return {
      vessel: segment.vessel,
      voyage: segment.voyage,
    }
  }

  if (dominantCandidate !== undefined) {
    return {
      vessel: dominantCandidate.nextVesselName,
      voyage: dominantCandidate.nextVoyage,
    }
  }

  for (let index = segment.events.length - 1; index >= 0; index--) {
    const event = segment.events[index]
    if (event === undefined) continue

    if (hasVesselOrVoyageIdentity(event.vesselName, event.voyage)) {
      return {
        vessel: toOptionalDisplayValue(event.vesselName),
        voyage: toOptionalDisplayValue(event.voyage),
      }
    }
  }

  return {
    vessel: segment.vessel,
    voyage: segment.voyage,
  }
}

function enrichVoyageSegments(
  voyageSegments: readonly VoyageSegment[],
  dominantPlannedHandoffs: ReadonlyMap<string, PlannedHandoffCandidate>,
): readonly ResolvedVoyageSegment[] {
  return voyageSegments.map((segment) => {
    const legKey = legKeyFor(segment.origin, segment.destination)
    const dominantCandidate = legKey === null ? undefined : dominantPlannedHandoffs.get(legKey)
    const identity = resolveSegmentDisplayIdentity(segment, dominantCandidate)

    return {
      ...segment,
      displayVessel: identity.vessel,
      displayVoyage: identity.voyage,
      legKey,
    }
  })
}

function hasActualVoyageExitEvidence(segment: VoyageSegment): boolean {
  return segment.events.some(
    (event) =>
      event.eventTimeType === 'ACTUAL' &&
      (event.type === 'ARRIVAL' || event.type === 'DISCHARGE' || event.type === 'LOAD'),
  )
}

function hasActualVoyageStartEvidence(segment: VoyageSegment): boolean {
  return segment.events.some(
    (event) =>
      event.eventTimeType === 'ACTUAL' && (event.type === 'LOAD' || event.type === 'DEPARTURE'),
  )
}

function detectConfirmedTransshipmentsBetweenVoyages(
  voyageSegments: readonly ResolvedVoyageSegment[],
): readonly ConfirmedTransshipmentDetection[] {
  const transshipments: ConfirmedTransshipmentDetection[] = []

  const voyageOnly = voyageSegments
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => isVoyageLikeSegment(seg))

  for (let i = 0; i < voyageOnly.length - 1; i++) {
    const current = voyageOnly[i]
    const next = voyageOnly[i + 1]
    if (current === undefined || next === undefined) continue

    if (current.seg.plannedContinuation || next.seg.plannedContinuation) {
      continue
    }

    if (!hasActualVoyageExitEvidence(current.seg) || !hasActualVoyageStartEvidence(next.seg)) {
      continue
    }

    const currentVessel = normalizeVesselName(current.seg.displayVessel)
    const nextVessel = normalizeVesselName(next.seg.displayVessel)
    const vesselChanged = currentVessel !== nextVessel
    const voyageChanged = current.seg.displayVoyage !== next.seg.displayVoyage

    if (!vesselChanged && !voyageChanged) {
      continue
    }

    let reason = 'Voyage change'
    if (vesselChanged && voyageChanged) {
      reason = 'Vessel and voyage change'
    } else if (vesselChanged) {
      reason = 'Vessel change'
    }

    transshipments.push({
      afterVoyageIndex: current.idx,
      port: current.seg.destination ?? next.seg.origin ?? null,
      reason,
      previousVesselName: current.seg.displayVessel,
      previousVoyage: current.seg.displayVoyage,
      nextVesselName: next.seg.displayVessel,
      nextVoyage: next.seg.displayVoyage,
    })
  }

  return transshipments
}

type PositionedVoyageSegment = {
  readonly segment: ResolvedVoyageSegment
  readonly firstEventIndex: number
  readonly lastEventIndex: number
}

type TerminalSegmentRenderUnit =
  | { readonly type: 'terminal'; readonly block: TerminalBlock }
  | { readonly type: 'planned-transshipment'; readonly block: PlannedTransshipmentBlock }

function positionVoyageLikeSegments(
  orderedEvents: readonly TrackingTimelineItem[],
  voyageSegments: readonly ResolvedVoyageSegment[],
): readonly PositionedVoyageSegment[] {
  return voyageSegments
    .map((segment) => {
      if (!isVoyageLikeSegment(segment)) {
        return null
      }

      const firstEvent = segment.events[0]
      const lastEvent = segment.events[segment.events.length - 1]
      if (firstEvent === undefined || lastEvent === undefined) {
        return null
      }

      const firstEventIndex = orderedEvents.findIndex((event) => event.id === firstEvent.id)
      const lastEventIndex = orderedEvents.findIndex((event) => event.id === lastEvent.id)
      if (firstEventIndex < 0 || lastEventIndex < 0) {
        return null
      }

      return {
        segment,
        firstEventIndex,
        lastEventIndex,
      }
    })
    .filter((segment): segment is PositionedVoyageSegment => segment !== null)
}

function findAdjacentVoyageLikeSegmentsForEvent(command: {
  readonly event: TrackingTimelineItem
  readonly orderedEvents: readonly TrackingTimelineItem[]
  readonly positionedVoyageSegments: readonly PositionedVoyageSegment[]
}): {
  readonly previous: PositionedVoyageSegment | null
  readonly next: PositionedVoyageSegment | null
} {
  const eventIndex = command.orderedEvents.findIndex(
    (candidate) => candidate.id === command.event.id,
  )

  if (eventIndex < 0) {
    return {
      previous: null,
      next: null,
    }
  }

  let previous: PositionedVoyageSegment | null = null
  let next: PositionedVoyageSegment | null = null

  for (const segment of command.positionedVoyageSegments) {
    if (segment.lastEventIndex < eventIndex) {
      previous = segment
      continue
    }

    if (segment.firstEventIndex > eventIndex) {
      next = segment
      break
    }
  }

  return {
    previous,
    next,
  }
}

function splitTerminalSegmentIntoRenderUnits(command: {
  readonly segment: TerminalSegment
  readonly orderedEvents: readonly TrackingTimelineItem[]
  readonly positionedVoyageSegments: readonly PositionedVoyageSegment[]
}): readonly TerminalSegmentRenderUnit[] {
  const units: TerminalSegmentRenderUnit[] = []
  let currentRun: TrackingTimelineItem[] = []
  const shouldEmitExplicitPlannedBlocks = command.segment.events.some(
    (event) => event.type !== 'TRANSSHIPMENT_INTENDED',
  )

  const flushCurrentRun = (): void => {
    if (currentRun.length === 0) {
      return
    }

    units.push({
      type: 'terminal',
      block: {
        blockType: 'terminal',
        kind: command.segment.kind,
        title: command.segment.title,
        location: dominantLocation(currentRun),
        events: currentRun,
      },
    })
    currentRun = []
  }

  for (const event of command.segment.events) {
    if (event.type !== 'TRANSSHIPMENT_INTENDED' || !shouldEmitExplicitPlannedBlocks) {
      currentRun.push(event)
      continue
    }

    flushCurrentRun()

    const adjacentSegments = findAdjacentVoyageLikeSegmentsForEvent({
      event,
      orderedEvents: command.orderedEvents,
      positionedVoyageSegments: command.positionedVoyageSegments,
    })

    units.push({
      type: 'planned-transshipment',
      block: {
        blockType: 'planned-transshipment',
        port:
          event.location ??
          adjacentSegments.previous?.segment.destination ??
          adjacentSegments.next?.segment.origin ??
          null,
        event,
        fromVessel: adjacentSegments.previous?.segment.displayVessel ?? null,
        fromVoyage: adjacentSegments.previous?.segment.displayVoyage ?? null,
        toVessel: adjacentSegments.next?.segment.displayVessel ?? null,
        toVoyage: adjacentSegments.next?.segment.displayVoyage ?? null,
      },
    })
  }

  flushCurrentRun()

  return units
}

function isPlannedTransshipmentTerminal(segment: TerminalSegment): boolean {
  return (
    segment.kind === 'transshipment-terminal' &&
    segment.events.length > 0 &&
    segment.events.every((event) => event.type === 'TRANSSHIPMENT_INTENDED')
  )
}

function toPlannedTransshipmentBlock(params: {
  readonly segment: TerminalSegment
  readonly previousSegment: ResolvedVoyageSegment | null
  readonly nextSegment: ResolvedVoyageSegment | null
}): TransshipmentBlock {
  const { segment, previousSegment, nextSegment } = params
  const representativeEvent = segment.events[segment.events.length - 1] ?? null

  return createTransshipmentBlock({
    mode: 'planned',
    port: segment.location,
    reason: representativeEvent?.carrierLabel ?? null,
    previousVesselName: previousSegment?.displayVessel ?? null,
    previousVoyage: previousSegment?.displayVoyage ?? null,
    nextVesselName:
      toOptionalDisplayValue(representativeEvent?.vesselName) ?? nextSegment?.displayVessel ?? null,
    nextVoyage:
      toOptionalDisplayValue(representativeEvent?.voyage) ?? nextSegment?.displayVoyage ?? null,
    events: segment.events,
  })
}

function plannedContinuationAnchorEvent(segment: VoyageSegment): TrackingTimelineItem | null {
  if (!segment.plannedContinuation) return null

  for (const event of segment.events) {
    if (event.type === 'TRANSSHIPMENT_INTENDED' && event.eventTimeType === 'EXPECTED') {
      return event
    }
  }

  return null
}

function collapseRedundantProjectedDestinationEvents(
  segment: ResolvedVoyageSegment,
  events: readonly TrackingTimelineItem[],
): readonly TrackingTimelineItem[] {
  if (
    !segment.plannedContinuation &&
    !hasVesselOrVoyageIdentity(segment.displayVessel, segment.displayVoyage)
  ) {
    return events
  }

  const specificDestinationKeys = new Set<string>()
  for (const event of events) {
    if (
      event.eventTimeType === 'EXPECTED' &&
      (event.type === 'ARRIVAL' || event.type === 'DISCHARGE') &&
      event.location === segment.destination &&
      hasVesselOrVoyageIdentity(event.vesselName, event.voyage)
    ) {
      specificDestinationKeys.add(`${event.type}|${event.location ?? ''}`)
    }
  }

  if (specificDestinationKeys.size === 0) {
    return events
  }

  return events.filter((event) => {
    if (
      event.eventTimeType !== 'EXPECTED' ||
      (event.type !== 'ARRIVAL' && event.type !== 'DISCHARGE') ||
      !specificDestinationKeys.has(`${event.type}|${event.location ?? ''}`)
    ) {
      return true
    }

    return hasVesselOrVoyageIdentity(event.vesselName, event.voyage)
  })
}

function displayEventsForVoyageSegment(
  segment: ResolvedVoyageSegment,
): readonly TrackingTimelineItem[] {
  const events = segment.plannedContinuation
    ? segment.events.filter((event) => event.type !== 'TRANSSHIPMENT_INTENDED')
    : segment.events

  return collapseRedundantProjectedDestinationEvents(segment, events)
}

function isSuppressiblePlannedTerminalRemainder(segment: TerminalSegment): boolean {
  if (segment.kind !== 'transshipment-terminal' || segment.events.length === 0) {
    return false
  }

  return segment.events.every(
    (event) =>
      event.eventTimeType === 'EXPECTED' &&
      (event.type === 'TRANSSHIPMENT_INTENDED' ||
        event.type === 'ARRIVAL' ||
        event.type === 'DISCHARGE'),
  )
}

function toPlannedTransshipmentBlockFromSegment(params: {
  readonly segment: ResolvedVoyageSegment
  readonly previousSegment: ResolvedVoyageSegment | null
  readonly dominantPlannedCandidate: PlannedHandoffCandidate | undefined
}): TransshipmentBlock | null {
  const { segment, previousSegment, dominantPlannedCandidate } = params
  const anchor = plannedContinuationAnchorEvent(segment)
  if (anchor === null) return null

  return createTransshipmentBlock({
    mode: 'planned',
    port: anchor.location ?? segment.origin,
    reason: anchor.carrierLabel ?? dominantPlannedCandidate?.event.carrierLabel ?? null,
    previousVesselName: previousSegment?.displayVessel ?? null,
    previousVoyage: previousSegment?.displayVoyage ?? null,
    nextVesselName: dominantPlannedCandidate?.nextVesselName ?? segment.displayVessel,
    nextVoyage: dominantPlannedCandidate?.nextVoyage ?? segment.displayVoyage,
    events: [anchor],
  })
}

// ---------------------------------------------------------------------------
// Phase 11-14 — Gap Marker Computation (projection-only)
// ---------------------------------------------------------------------------

const GAP_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

const TRANSIT_GAP_PAIRS: ReadonlySet<string> = new Set([
  'DEPARTURE->ARRIVAL',
  'LOAD->ARRIVAL',
  'DEPARTURE->DISCHARGE',
  'LOAD->DISCHARGE',
])

function isTransitGap(fromType: string, toType: string): boolean {
  return TRANSIT_GAP_PAIRS.has(`${fromType}->${toType}`)
}

const TIMELINE_BLOCK_COMPARE_OPTIONS = {
  timezone: 'UTC',
  strategy: 'start-of-day',
} as const

function toTimelineInstant(value: TemporalValueDto | null): Instant | null {
  if (value === null) return null
  const temporalValue = parseTemporalValue(value)
  if (temporalValue === null) return null
  return toComparableInstant(temporalValue, TIMELINE_BLOCK_COMPARE_OPTIONS)
}

function computeGapMarkers(events: readonly TrackingTimelineItem[]): readonly GapMarker[] {
  const markers: GapMarker[] = []

  // Filter to events with actual timestamps for gap computation
  const datedEvents = events.filter((event) => toTimelineInstant(event.eventTime) !== null)

  for (let i = 0; i < datedEvents.length - 1; i++) {
    const current = datedEvents[i]
    const next = datedEvents[i + 1]
    if (current === undefined || next === undefined) continue

    const currentTime = toTimelineInstant(current.eventTime)
    const nextTime = toTimelineInstant(next.eventTime)
    if (!currentTime || !nextTime) continue

    const deltaMs = Math.abs(nextTime.diffMs(currentTime))

    if (deltaMs >= GAP_THRESHOLD_MS) {
      const durationDays = Math.round(deltaMs / (24 * 60 * 60 * 1000))
      const kind = isTransitGap(current.type, next.type) ? 'transit' : 'generic'

      markers.push({
        blockType: 'gap-marker',
        kind,
        durationDays,
        fromEventType: current.type,
        toEventType: next.type,
      })
    }
  }

  return markers
}

// ---------------------------------------------------------------------------
// Phase 15-19 — Port Risk Window Detection (projection-only)
// ---------------------------------------------------------------------------

const PORT_ARRIVAL_TYPES: ReadonlySet<string> = new Set(['ARRIVAL'])
const PORT_EXIT_TYPES: ReadonlySet<string> = new Set(['DISCHARGE', 'GATE_OUT', 'DELIVERY'])

/** Days-based severity for port risk */
function portRiskSeverity(days: number): 'info' | 'warning' | 'danger' {
  if (days >= 4) return 'danger'
  if (days >= 2) return 'warning'
  return 'info'
}

function computePortRiskMarkers(
  events: readonly TrackingTimelineItem[],
  now: Instant,
): readonly { readonly marker: PortRiskMarker; readonly afterEventId: string }[] {
  const markers: { marker: PortRiskMarker; afterEventId: string }[] = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event === undefined) continue

    if (!PORT_ARRIVAL_TYPES.has(event.type)) continue
    const arrivalTime = toTimelineInstant(event.eventTime)
    if (!arrivalTime) continue

    // Look forward for an exit event
    let exitTime: Instant | null = null
    for (let j = i + 1; j < events.length; j++) {
      const nextEvent = events[j]
      if (nextEvent === undefined) continue

      const exitTimeValue = toTimelineInstant(nextEvent.eventTime)
      if (PORT_EXIT_TYPES.has(nextEvent.type) && exitTimeValue) {
        exitTime = exitTimeValue
        break
      }
    }

    let durationMs: number
    let ongoing: boolean

    if (exitTime !== null) {
      durationMs = exitTime.diffMs(arrivalTime)
      ongoing = false
    } else {
      durationMs = now.diffMs(arrivalTime)
      ongoing = true
    }

    const durationDays = Math.round(durationMs / (24 * 60 * 60 * 1000))

    // Only show port risk for ≥ 2 days
    if (durationDays >= 2) {
      markers.push({
        marker: {
          blockType: 'port-risk-marker',
          durationDays,
          ongoing,
          severity: portRiskSeverity(durationDays),
        },
        afterEventId: event.id,
      })
    }
  }

  return markers
}

// ---------------------------------------------------------------------------
// Public: Assemble Full Block Pipeline
// ---------------------------------------------------------------------------

/** A positioned item in the final render list */
export type TimelineRenderItem =
  | { readonly type: 'voyage-block'; readonly block: VoyageBlock }
  | { readonly type: 'terminal-block'; readonly block: TerminalBlock }
  | { readonly type: 'transshipment-block'; readonly block: TransshipmentBlock }
  | { readonly type: 'planned-transshipment-block'; readonly block: PlannedTransshipmentBlock }
  | { readonly type: 'event'; readonly event: TrackingTimelineItem; readonly isLast: boolean }
  | { readonly type: 'gap-marker'; readonly marker: GapMarker }
  | { readonly type: 'port-risk-marker'; readonly marker: PortRiskMarker }
  | { readonly type: 'block-end' }

/**
 * Build the complete timeline render list from raw timeline events.
 *
 * This is the single rendering pipeline (Phase 4) that:
 * 1. Groups events into voyage and terminal segments
 * 2. Inserts transshipment markers between different voyages
 * 3. Computes gap markers between events
 * 4. Computes port risk markers after ARRIVAL events
 * 5. Interleaves all items into a flat render list
 *
 * All derivations are projection-only, deterministic, and side-effect-free.
 *
 * @param events - Ordered timeline events for a single container
 * @param now - Current date for monitoring markers (port risk ongoing)
 * @returns Flat render list ready for sequential rendering
 */
export function buildTimelineRenderList(
  events: readonly TrackingTimelineItem[],
  now: Instant = systemClock.now(),
): readonly TimelineRenderItem[] {
  if (events.length === 0) return []

  const orderedEvents = sortTimelineItemsForBlockDerivation(events)
  const baseVoyageSegments = groupVoyageSegments(orderedEvents)
  const dominantPlannedHandoffs = resolveDominantPlannedHandoffCandidates(orderedEvents)
  const voyageSegments = enrichVoyageSegments(baseVoyageSegments, dominantPlannedHandoffs)
  const terminalSegments = groupTerminalSegments(orderedEvents, voyageSegments)
  const positionedVoyageSegments = positionVoyageLikeSegments(orderedEvents, voyageSegments)
  const transshipments = detectConfirmedTransshipmentsBetweenVoyages(voyageSegments)
  const gapMarkers = computeGapMarkers(orderedEvents)
  const portRiskEntries = computePortRiskMarkers(orderedEvents, now)

  // Build a set of port-risk afterEventIds for Phase 19:
  // suppress generic gap markers that overlap with port risk windows
  const portRiskEventIds = new Set(portRiskEntries.map((pr) => pr.afterEventId))

  // Map gap markers by position: keyed by "fromEventId" for placement
  const gapsByFromEvent = new Map<string, GapMarker>()
  {
    const datedEvents = orderedEvents.filter((event) => toTimelineInstant(event.eventTime) !== null)
    let gapIdx = 0
    for (let i = 0; i < datedEvents.length - 1 && gapIdx < gapMarkers.length; i++) {
      const current = datedEvents[i]
      const next = datedEvents[i + 1]
      if (current === undefined || next === undefined) continue

      const currentTime = toTimelineInstant(current.eventTime)
      const nextTime = toTimelineInstant(next.eventTime)
      if (!currentTime || !nextTime) continue
      const deltaMs = Math.abs(nextTime.diffMs(currentTime))

      if (deltaMs >= GAP_THRESHOLD_MS) {
        const gapMarker = gapMarkers[gapIdx]
        // Phase 19: skip if this gap overlaps a port risk marker
        if (!portRiskEventIds.has(current.id) && gapMarker !== undefined) {
          gapsByFromEvent.set(current.id, gapMarker)
        }
        gapIdx++
      }
    }
  }

  // Map port risk markers by their afterEventId
  const portRiskByEventId = new Map<string, PortRiskMarker>()
  for (const pr of portRiskEntries) {
    portRiskByEventId.set(pr.afterEventId, pr.marker)
  }

  // Build transshipment map: afterVoyageIndex → TransshipmentBlock
  const transshipmentMap = new Map<number, TransshipmentBlock>()
  for (const ts of transshipments) {
    transshipmentMap.set(
      ts.afterVoyageIndex,
      createTransshipmentBlock({
        mode: 'confirmed',
        port: ts.port,
        reason: ts.reason,
        previousVesselName: ts.previousVesselName,
        previousVoyage: ts.previousVoyage,
        nextVesselName: ts.nextVesselName,
        nextVoyage: ts.nextVoyage,
        events: [],
      }),
    )
  }

  // Now assemble the flat render list
  // We iterate through voyageSegments (which contain ALL events) and interleave terminal segments
  const result: TimelineRenderItem[] = []

  // Track which terminal segments we've used
  const usedTerminalSegmentIds = new Set<string>()
  const lastOverallEvent = orderedEvents[orderedEvents.length - 1] ?? null

  // Helper: emit events for a block with gap/port-risk markers interleaved
  function emitEventsWithMarkers(
    blockEvents: readonly TrackingTimelineItem[],
    isLastBlock: boolean,
  ): void {
    for (let i = 0; i < blockEvents.length; i++) {
      const event = blockEvents[i]
      if (event === undefined) continue

      const isLastEvent =
        isLastBlock && lastOverallEvent !== null && event.id === lastOverallEvent.id

      result.push({ type: 'event', event, isLast: isLastEvent })

      // Port risk marker after this event
      const portRisk = portRiskByEventId.get(event.id)
      if (portRisk) {
        result.push({ type: 'port-risk-marker', marker: portRisk })
      }

      // Gap marker after this event
      const gap = gapsByFromEvent.get(event.id)
      if (gap) {
        result.push({ type: 'gap-marker', marker: gap })
      }
    }
  }

  function emitTerminalSegmentRenderUnits(
    units: readonly TerminalSegmentRenderUnit[],
    hasNoMoreBlocks: boolean,
  ): void {
    let lastTerminalUnitIndex = -1
    for (let index = units.length - 1; index >= 0; index--) {
      if (units[index]?.type === 'terminal') {
        lastTerminalUnitIndex = index
        break
      }
    }

    for (const [index, unit] of units.entries()) {
      if (unit.type === 'planned-transshipment') {
        result.push({
          type: 'planned-transshipment-block',
          block: unit.block,
        })
        continue
      }

      result.push({
        type: 'terminal-block',
        block: unit.block,
      })
      emitEventsWithMarkers(unit.block.events, hasNoMoreBlocks && index === lastTerminalUnitIndex)
      result.push({ type: 'block-end' })
    }
  }

  // Pre-carriage terminal segments (before first voyage)
  for (const ts of terminalSegments) {
    if (ts.kind !== 'pre-carriage') continue
    usedTerminalSegmentIds.add(ts.id)
    emitTerminalSegmentRenderUnits(
      splitTerminalSegmentIntoRenderUnits({
        segment: ts,
        orderedEvents,
        positionedVoyageSegments,
      }),
      false,
    )
  }

  // Voyage segments with transshipment markers between them
  for (let segIdx = 0; segIdx < voyageSegments.length; segIdx++) {
    const segment = voyageSegments[segIdx]
    if (segment === undefined) continue

    const isLastSegment =
      segIdx === voyageSegments.length - 1 &&
      terminalSegments.every((terminalSegment) => terminalSegment.kind !== 'post-carriage')

    if (isVoyageLikeSegment(segment)) {
      const displayedVoyageEvents = displayEventsForVoyageSegment(segment)
      const previousVoyageEntry = findPreviousVoyageLikeSegment(voyageSegments, segIdx)
      const plannedContinuationBlock = toPlannedTransshipmentBlockFromSegment({
        segment,
        previousSegment: previousVoyageEntry?.segment ?? null,
        dominantPlannedCandidate:
          segment.legKey === null ? undefined : dominantPlannedHandoffs.get(segment.legKey),
      })

      if (plannedContinuationBlock !== null) {
        result.push({ type: 'transshipment-block', block: plannedContinuationBlock })
      }

      // It's a voyage block
      const voyageBlock: VoyageBlock = {
        blockType: 'voyage',
        vessel: segment.displayVessel,
        voyage: segment.displayVoyage,
        origin: segment.origin,
        destination: segment.destination,
        events: displayedVoyageEvents,
      }
      result.push({ type: 'voyage-block', block: voyageBlock })
      emitEventsWithMarkers(displayedVoyageEvents, isLastSegment)
      result.push({ type: 'block-end' })

      // Check for transshipment after this voyage
      const tsBlock = transshipmentMap.get(segIdx)
      if (tsBlock) {
        result.push({ type: 'transshipment-block', block: tsBlock })
      }

      // Check for transshipment-terminal segments between voyages
      for (const ts of terminalSegments) {
        if (ts.kind !== 'transshipment-terminal') continue
        if (usedTerminalSegmentIds.has(ts.id)) continue

        // Check if this terminal segment's events fall between current and next voyage
        const firstTermEvent = ts.events[0]
        if (firstTermEvent === undefined) continue

        const nextVoyageEntry = findNextVoyageLikeSegment(voyageSegments, segIdx)
        if (nextVoyageEntry === null) continue

        const lastCurrentVoyageEvent = segment.events[segment.events.length - 1]
        const firstNextVoyageEvent = nextVoyageEntry.segment.events[0]
        if (lastCurrentVoyageEvent === undefined || firstNextVoyageEvent === undefined) continue

        // Check if the terminal event is positioned between the two voyages
        const termEventIdx = orderedEvents.findIndex((e) => e.id === firstTermEvent.id)
        const lastCurrentVoyageIdx = orderedEvents.findIndex(
          (e) => e.id === lastCurrentVoyageEvent.id,
        )
        const firstNextVoyageIdx = orderedEvents.findIndex((e) => e.id === firstNextVoyageEvent.id)

        if (termEventIdx > lastCurrentVoyageIdx && termEventIdx < firstNextVoyageIdx) {
          usedTerminalSegmentIds.add(ts.id)

          if (
            nextVoyageEntry.segment.plannedContinuation &&
            isSuppressiblePlannedTerminalRemainder(ts)
          ) {
            continue
          }

          if (tsBlock === undefined && isPlannedTransshipmentTerminal(ts)) {
            result.push({
              type: 'transshipment-block',
              block: toPlannedTransshipmentBlock({
                segment: ts,
                previousSegment: segment,
                nextSegment: nextVoyageEntry.segment,
              }),
            })
            continue
          }

          emitTerminalSegmentRenderUnits(
            splitTerminalSegmentIntoRenderUnits({
              segment: ts,
              orderedEvents,
              positionedVoyageSegments,
            }),
            false,
          )
        }
      }
    } else {
      // Non-voyage segment that wasn't captured as a terminal segment
      // This can happen when events don't have voyages at all
      // Check if these events are already in a terminal segment
      const segEventIds = new Set(segment.events.map((e) => e.id))
      const isInTerminal = terminalSegments.some((ts) =>
        ts.events.some((e) => segEventIds.has(e.id)),
      )

      if (!isInTerminal) {
        const termBlock: TerminalBlock = {
          blockType: 'terminal',
          kind: 'pre-carriage',
          title: 'Terminal / Inland',
          location: dominantLocation(segment.events),
          events: segment.events,
        }
        result.push({ type: 'terminal-block', block: termBlock })
        emitEventsWithMarkers(segment.events, isLastSegment)
        result.push({ type: 'block-end' })
      }
    }
  }

  // Post-carriage terminal segments (after last voyage)
  for (const ts of terminalSegments) {
    if (ts.kind !== 'post-carriage') continue
    usedTerminalSegmentIds.add(ts.id)
    emitTerminalSegmentRenderUnits(
      splitTerminalSegmentIntoRenderUnits({
        segment: ts,
        orderedEvents,
        positionedVoyageSegments,
      }),
      true,
    )
  }

  return result
}

// ---------------------------------------------------------------------------
// Phase 26 (Future) — Port Risk Alerts (TODO only)
// ---------------------------------------------------------------------------

/**
 * TODO (Future — Phase 26): Port waiting time should also generate monitoring alerts.
 Issue URL: https://github.com/marcuscastelo/container-tracker/issues/96
 *
 * When implemented:
 * - category: 'movement'
 * - type: 'monitoring'
 * - trigger: arrived_at_port with no exit event for >3 days
 * - These alerts should appear in AlertsPanel + Dashboard
 *
 * Acceptance criteria:
 * - Alert is created when ARRIVAL event exists with no subsequent DISCHARGE/GATE_OUT/DELIVERY for >3 days
 * - Alert includes durationDays and port information
 * - Alert is retroactive: false (monitoring only)
 * - Alert is resolved automatically when exit event arrives
 *
 * @see docs/ALERT_POLICY.md for alert classification rules
 * @see Phase 15-19 in the PRD for port risk window detection logic
 */
