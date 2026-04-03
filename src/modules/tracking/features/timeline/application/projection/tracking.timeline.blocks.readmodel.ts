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
  readonly kind: TerminalSegmentKind
  readonly location: string | null
  readonly events: readonly TrackingTimelineItem[]
}

function isVoyageLikeSegment(segment: VoyageSegment): boolean {
  return segment.vessel !== null || segment.voyage !== null
}

function findNextVoyageLikeSegment(
  voyageSegments: readonly VoyageSegment[],
  currentIndex: number,
): { readonly index: number; readonly segment: VoyageSegment } | null {
  for (let index = currentIndex + 1; index < voyageSegments.length; index++) {
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
        let kind: TerminalSegmentKind
        if (runPosition === 'before') kind = 'pre-carriage'
        else if (runPosition === 'after') kind = 'post-carriage'
        else kind = 'transshipment-terminal'

        segments.push({
          kind,
          location: dominantLocation(currentRun),
          events: currentRun,
        })
        currentRun = []
      }
      // After the first voyage event, the run position switches
      if (i >= lastVoyageIdx) {
        runPosition = 'after'
      } else {
        runPosition = 'between'
      }
    } else {
      currentRun.push(event)
    }
  }

  // Flush remaining terminal events
  if (currentRun.length > 0) {
    const kind: TerminalSegmentKind =
      firstVoyageIdx === -1
        ? 'pre-carriage' // no voyages at all → treat as pre-carriage
        : 'post-carriage'
    segments.push({
      kind,
      location: dominantLocation(currentRun),
      events: currentRun,
    })
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
  readonly location: string | null
  readonly events: readonly TrackingTimelineItem[]
}

export type TransshipmentBlock = {
  readonly blockType: 'transshipment'
  readonly port: string | null
  readonly reason: string | null
  readonly fromVessel: string | null
  readonly toVessel: string | null
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

// ---------------------------------------------------------------------------
// Phase 5 — Transshipment Detection
// ---------------------------------------------------------------------------

function detectTransshipmentsBetweenVoyages(voyageSegments: readonly VoyageSegment[]): readonly {
  readonly afterVoyageIndex: number
  readonly port: string | null
  readonly reason: string
  readonly fromVessel: string | null
  readonly toVessel: string | null
}[] {
  const transshipments: {
    afterVoyageIndex: number
    port: string | null
    reason: string
    fromVessel: string | null
    toVessel: string | null
  }[] = []

  // Only consider segments that are voyage-like (vessel or voyage present)
  const voyageOnly = voyageSegments
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => isVoyageLikeSegment(seg))

  for (let i = 0; i < voyageOnly.length - 1; i++) {
    const current = voyageOnly[i]
    const next = voyageOnly[i + 1]
    if (current === undefined || next === undefined) continue

    const currentVessel = normalizeVesselName(current.seg.vessel)
    const nextVessel = normalizeVesselName(next.seg.vessel)
    const vesselChanged = currentVessel !== nextVessel
    const voyageChanged = current.seg.voyage !== next.seg.voyage

    // Transshipment when vessel or voyage differs
    if (vesselChanged || voyageChanged) {
      const port = current.seg.destination ?? next.seg.origin ?? null
      let reason = 'Voyage change'
      if (vesselChanged && voyageChanged) {
        reason = 'Vessel and voyage change'
      } else if (vesselChanged) {
        reason = 'Vessel change'
      }

      transshipments.push({
        afterVoyageIndex: current.idx,
        port,
        reason,
        fromVessel: current.seg.vessel,
        toVessel: next.seg.vessel,
      })
    }
  }

  return transshipments
}

// ---------------------------------------------------------------------------
// Phase 11-14 — Gap Marker Computation (UI-only)
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
// Phase 15-19 — Port Risk Window Detection (UI-only)
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
 * All derivations are UI-only, deterministic, and side-effect-free.
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

  const voyageSegments = groupVoyageSegments(events)
  const terminalSegments = groupTerminalSegments(events, voyageSegments)
  const transshipments = detectTransshipmentsBetweenVoyages(voyageSegments)
  const gapMarkers = computeGapMarkers(events)
  const portRiskEntries = computePortRiskMarkers(events, now)

  // Build a set of port-risk afterEventIds for Phase 19:
  // suppress generic gap markers that overlap with port risk windows
  const portRiskEventIds = new Set(portRiskEntries.map((pr) => pr.afterEventId))

  // Map gap markers by position: keyed by "fromEventId" for placement
  const gapsByFromEvent = new Map<string, GapMarker>()
  {
    const datedEvents = events.filter((event) => toTimelineInstant(event.eventTime) !== null)
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
    transshipmentMap.set(ts.afterVoyageIndex, {
      blockType: 'transshipment',
      port: ts.port,
      reason: ts.reason,
      fromVessel: ts.fromVessel,
      toVessel: ts.toVessel,
    })
  }

  // Now assemble the flat render list
  // We iterate through voyageSegments (which contain ALL events) and interleave terminal segments
  const result: TimelineRenderItem[] = []

  // Track which terminal segments we've used
  const usedTerminalKinds = new Set<string>()

  // Helper: emit events for a block with gap/port-risk markers interleaved
  function emitEventsWithMarkers(
    blockEvents: readonly TrackingTimelineItem[],
    isLastBlock: boolean,
  ): void {
    const lastOverallEvent = events[events.length - 1] ?? null

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

  // Pre-carriage terminal segments (before first voyage)
  for (const ts of terminalSegments) {
    if (ts.kind !== 'pre-carriage') continue
    usedTerminalKinds.add('pre-carriage')

    const termBlock: TerminalBlock = {
      blockType: 'terminal',
      kind: ts.kind,
      location: ts.location,
      events: ts.events,
    }
    result.push({ type: 'terminal-block', block: termBlock })
    emitEventsWithMarkers(ts.events, false)
    result.push({ type: 'block-end' })
  }

  // Voyage segments with transshipment markers between them
  for (let segIdx = 0; segIdx < voyageSegments.length; segIdx++) {
    const segment = voyageSegments[segIdx]
    if (segment === undefined) continue

    const isLastSegment =
      segIdx === voyageSegments.length - 1 &&
      terminalSegments.every((ts) => ts.kind !== 'post-carriage')

    if (isVoyageLikeSegment(segment)) {
      // It's a voyage block
      const voyageBlock: VoyageBlock = {
        blockType: 'voyage',
        vessel: segment.vessel,
        voyage: segment.voyage,
        origin: segment.origin,
        destination: segment.destination,
        events: segment.events,
      }
      result.push({ type: 'voyage-block', block: voyageBlock })
      emitEventsWithMarkers(segment.events, isLastSegment)
      result.push({ type: 'block-end' })

      // Check for transshipment after this voyage
      const tsBlock = transshipmentMap.get(segIdx)
      if (tsBlock) {
        result.push({ type: 'transshipment-block', block: tsBlock })
      }

      // Check for transshipment-terminal segments between voyages
      for (const ts of terminalSegments) {
        if (ts.kind !== 'transshipment-terminal') continue
        if (usedTerminalKinds.has(`ts-${segIdx}`)) continue

        // Check if this terminal segment's events fall between current and next voyage
        const firstTermEvent = ts.events[0]
        if (firstTermEvent === undefined) continue

        const nextVoyageEntry = findNextVoyageLikeSegment(voyageSegments, segIdx)
        if (nextVoyageEntry === null) continue

        const lastCurrentVoyageEvent = segment.events[segment.events.length - 1]
        const firstNextVoyageEvent = nextVoyageEntry.segment.events[0]
        if (lastCurrentVoyageEvent === undefined || firstNextVoyageEvent === undefined) continue

        // Check if the terminal event is positioned between the two voyages
        const termEventIdx = events.findIndex((e) => e.id === firstTermEvent.id)
        const lastCurrentVoyageIdx = events.findIndex((e) => e.id === lastCurrentVoyageEvent.id)
        const firstNextVoyageIdx = events.findIndex((e) => e.id === firstNextVoyageEvent.id)

        if (termEventIdx > lastCurrentVoyageIdx && termEventIdx < firstNextVoyageIdx) {
          usedTerminalKinds.add(`ts-${segIdx}`)
          const termBlock: TerminalBlock = {
            blockType: 'terminal',
            kind: ts.kind,
            location: ts.location,
            events: ts.events,
          }
          result.push({ type: 'terminal-block', block: termBlock })
          emitEventsWithMarkers(ts.events, false)
          result.push({ type: 'block-end' })
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
    usedTerminalKinds.add('post-carriage')

    const hasNoMoreBlocks = true
    const termBlock: TerminalBlock = {
      blockType: 'terminal',
      kind: ts.kind,
      location: ts.location,
      events: ts.events,
    }
    result.push({ type: 'terminal-block', block: termBlock })
    emitEventsWithMarkers(ts.events, hasNoMoreBlocks)
    result.push({ type: 'block-end' })
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
