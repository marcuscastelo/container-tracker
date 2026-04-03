import { describe, expect, it } from 'vitest'
import { buildTimelineRenderList } from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import {
  instantFromIsoText,
  resolveTemporalDto,
  temporalDtoFromCanonical,
} from '~/shared/time/tests/helpers'

type TimelineItemOverrides = Omit<Partial<TrackingTimelineItem>, 'eventTime'> &
  Pick<TrackingTimelineItem, 'type'> & {
    readonly eventTime?: string | TrackingTimelineItem['eventTime']
  }

function makeEvent(overrides: TimelineItemOverrides): TrackingTimelineItem {
  const { eventTime, ...rest } = overrides

  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 8)}`,
    eventTime: resolveTemporalDto(eventTime, temporalDtoFromCanonical('2026-03-01T00:00:00Z')),
    eventTimeType: 'ACTUAL',
    derivedState: 'ACTUAL',
    ...rest,
  }
}

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected value to be defined in test fixture')
  }

  return value
}

// ---------------------------------------------------------------------------
// Phase 4-5 — buildTimelineRenderList (block assembly + transshipment)
// ---------------------------------------------------------------------------
describe('buildTimelineRenderList voyage grouping', () => {
  it('returns empty list for empty events', () => {
    expect(buildTimelineRenderList([])).toEqual([])
  })

  it('creates a voyage block for a single voyage', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DEPARTURE', location: 'A' }),
      makeEvent({ id: 'e3', type: 'ARRIVAL', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'B' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((r) => r.type === 'voyage-block')
    expect(voyageBlocks).toHaveLength(1)

    const vb = requireDefined(voyageBlocks[0])
    if (vb.type === 'voyage-block') {
      expect(vb.block.vessel).toBe('V1')
      expect(vb.block.origin).toBe('A')
      expect(vb.block.destination).toBe('B')
    }
  })

  it('creates a predicted voyage block starting from DEPARTURE EXPECTED without a preceding LOAD', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'DEPARTURE',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        location: 'KARACHI, PK',
      }),
      makeEvent({
        id: 'e2',
        type: 'ARRIVAL',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        location: 'COLOMBO, LK',
      }),
    ]

    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-04-02T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((r) => r.type === 'voyage-block')
    expect(voyageBlocks).toHaveLength(1)

    const voyageBlock = requireDefined(voyageBlocks[0])
    if (voyageBlock.type === 'voyage-block') {
      expect(voyageBlock.block.vessel).toBe('MSC MIRAYA V')
      expect(voyageBlock.block.voyage).toBe('OB612R')
      expect(voyageBlock.block.origin).toBe('KARACHI, PK')
      expect(voyageBlock.block.destination).toBe('COLOMBO, LK')
    }
  })

  it('inserts transshipment block between different voyages', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V2', voyage: 'VY2', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')
    expect(tsBlocks).toHaveLength(1)

    const transshipmentBlock = requireDefined(tsBlocks[0])
    if (transshipmentBlock.type === 'transshipment-block') {
      expect(transshipmentBlock.block.port).toBe('B')
      expect(transshipmentBlock.block.reasonCode).toBe('vessel-and-voyage-change')
      expect(transshipmentBlock.block.fromVessel).toBe('V1')
      expect(transshipmentBlock.block.toVessel).toBe('V2')
    }
  })

  it('sets transshipment reason to voyage change when vessel is unchanged', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V1', voyage: 'VY2', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )
    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')

    expect(tsBlocks).toHaveLength(1)
    const transshipmentBlock = requireDefined(tsBlocks[0])
    if (transshipmentBlock.type === 'transshipment-block') {
      expect(transshipmentBlock.block.reasonCode).toBe('voyage-change')
    }
  })

  it('sets transshipment reason to vessel change when voyage is unchanged', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V2', voyage: 'VY1', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )
    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')

    expect(tsBlocks).toHaveLength(1)
    const transshipmentBlock = requireDefined(tsBlocks[0])
    if (transshipmentBlock.type === 'transshipment-block') {
      expect(transshipmentBlock.block.reasonCode).toBe('vessel-change')
    }
  })

  it('does NOT insert transshipment when same vessel continues', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')
    expect(tsBlocks).toHaveLength(0)
  })

  it('does NOT insert transshipment when vessel differs only by casing or whitespace', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: ' MAERSK ', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'maersk', voyage: 'VY1', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')
    expect(tsBlocks).toHaveLength(0)
  })
})

describe('buildTimelineRenderList terminal grouping', () => {
  it('creates pre-carriage terminal block for events before voyage', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'GATE_IN', location: 'Terminal X' }),
      makeEvent({ id: 'e2', type: 'LOAD', vesselName: 'V1', location: 'Port A' }),
      makeEvent({ id: 'e3', type: 'DISCHARGE', location: 'Port B' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const termBlocks = renderList.filter((r) => r.type === 'terminal-block')
    expect(termBlocks).toHaveLength(1)

    const terminalBlock = requireDefined(termBlocks[0])
    if (terminalBlock.type === 'terminal-block') {
      expect(terminalBlock.block.kind).toBe('pre-carriage')
    }
  })

  it('handles events-only scenario (no voyages) as terminal block', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'GATE_IN', location: 'T1' }),
      makeEvent({ id: 'e2', type: 'GATE_OUT', location: 'T1' }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const termBlocks = renderList.filter((r) => r.type === 'terminal-block')
    expect(termBlocks.length).toBeGreaterThanOrEqual(1)
  })

  it('renders transshipment helper events as transshipment-terminal between maritime legs', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({
        id: 'e3',
        type: 'TRANSSHIPMENT_INTENDED',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'B',
      }),
      makeEvent({
        id: 'e4',
        type: 'TRANSSHIPMENT_POSITIONED_IN',
        location: 'B',
      }),
      makeEvent({
        id: 'e5',
        type: 'DEPARTURE',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'V2',
        voyage: 'VY2',
        location: 'B',
      }),
      makeEvent({
        id: 'e6',
        type: 'ARRIVAL',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'V2',
        voyage: 'VY2',
        location: 'C',
      }),
    ]

    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-02T00:00:00.000Z'),
    )

    const transshipmentTerminalBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )
    expect(transshipmentTerminalBlocks).toHaveLength(1)

    const terminalBlock = requireDefined(transshipmentTerminalBlocks[0])
    if (terminalBlock.type === 'terminal-block') {
      expect(terminalBlock.block.events.map((event) => event.type)).toEqual([
        'TRANSSHIPMENT_INTENDED',
        'TRANSSHIPMENT_POSITIONED_IN',
      ])
    }
  })
})

// ---------------------------------------------------------------------------
// Phase 11-14 — Gap markers
// ---------------------------------------------------------------------------
describe('gap markers', () => {
  it('inserts a transit gap marker for 3-day gap between DEPARTURE and ARRIVAL', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'DEPARTURE',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
        location: 'A',
      }),
      makeEvent({
        id: 'e2',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
        location: 'B',
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-05T00:00:00.000Z'),
    )

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    expect(gaps).toHaveLength(1)

    const gap = requireDefined(gaps[0])
    if (gap.type === 'gap-marker') {
      expect(gap.marker.kind).toBe('transit')
      expect(gap.marker.durationDays).toBe(3)
    }
  })

  it('inserts a generic gap marker for non-vessel events', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'GATE_IN',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
        location: 'T',
      }),
      makeEvent({
        id: 'e2',
        type: 'GATE_OUT',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
        location: 'T',
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-05T00:00:00.000Z'),
    )

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    expect(gaps).toHaveLength(1)

    const gap = requireDefined(gaps[0])
    if (gap.type === 'gap-marker') {
      expect(gap.marker.kind).toBe('generic')
    }
  })

  it('does NOT insert gap marker for short intervals', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'GATE_IN',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        type: 'GATE_OUT',
        eventTime: temporalDtoFromCanonical('2026-03-02T00:00:00Z'),
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-03T00:00:00.000Z'),
    )

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    expect(gaps).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 15-19 — Port risk markers
// ---------------------------------------------------------------------------
describe('port risk markers', () => {
  it('inserts port risk marker when container sits at port for 3+ days', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
        location: 'Port X',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
        location: 'Port X',
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-05T00:00:00.000Z'),
    )

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(1)

    const risk = requireDefined(risks[0])
    if (risk.type === 'port-risk-marker') {
      expect(risk.marker.durationDays).toBe(3)
      expect(risk.marker.ongoing).toBe(false)
      expect(risk.marker.severity).toBe('warning')
    }
  })

  it('inserts ongoing port risk marker when no exit event', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
        location: 'Port Y',
      }),
    ]
    const now = instantFromIsoText('2026-03-06T00:00:00.000Z')
    const renderList = buildTimelineRenderList(events, now)

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(1)

    const risk = requireDefined(risks[0])
    if (risk.type === 'port-risk-marker') {
      expect(risk.marker.durationDays).toBe(5)
      expect(risk.marker.ongoing).toBe(true)
      expect(risk.marker.severity).toBe('danger')
    }
  })

  it('applies correct severity levels', () => {
    // 2 days = warning
    const events2d = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTime: temporalDtoFromCanonical('2026-03-03T00:00:00Z'),
      }),
    ]
    const risks2d = buildTimelineRenderList(
      events2d,
      instantFromIsoText('2026-03-04T00:00:00.000Z'),
    ).filter((r) => r.type === 'port-risk-marker')
    expect(risks2d).toHaveLength(1)
    const risk2d = requireDefined(risks2d[0])
    if (risk2d.type === 'port-risk-marker') {
      expect(risk2d.marker.severity).toBe('warning')
    }

    // 4 days = danger
    const events4d = [
      makeEvent({
        id: 'e3',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e4',
        type: 'DISCHARGE',
        eventTime: temporalDtoFromCanonical('2026-03-05T00:00:00Z'),
      }),
    ]
    const risks4d = buildTimelineRenderList(
      events4d,
      instantFromIsoText('2026-03-06T00:00:00.000Z'),
    ).filter((r) => r.type === 'port-risk-marker')
    expect(risks4d).toHaveLength(1)
    const risk4d = requireDefined(risks4d[0])
    if (risk4d.type === 'port-risk-marker') {
      expect(risk4d.marker.severity).toBe('danger')
    }
  })

  it('suppresses generic gap marker when port risk marker covers the same interval (Phase 19)', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
        location: 'Port',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
        location: 'Port',
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-05T00:00:00.000Z'),
    )

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    const risks = renderList.filter((r) => r.type === 'port-risk-marker')

    expect(risks).toHaveLength(1)
    // Gap marker should be suppressed since port risk covers it
    expect(gaps).toHaveLength(0)
  })

  it('does not add port risk for short stays (< 2 days)', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTime: temporalDtoFromCanonical('2026-03-02T00:00:00Z'),
      }),
    ]
    const renderList = buildTimelineRenderList(
      events,
      instantFromIsoText('2026-03-03T00:00:00.000Z'),
    )

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(0)
  })
})
