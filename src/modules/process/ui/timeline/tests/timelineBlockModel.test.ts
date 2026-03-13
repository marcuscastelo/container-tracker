import { describe, expect, it } from 'vitest'
import { buildTimelineRenderList } from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

function makeEvent(
  overrides: Partial<TrackingTimelineItem> & Pick<TrackingTimelineItem, 'type'>,
): TrackingTimelineItem {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2, 8)}`,
    eventTimeIso: '2026-03-01T00:00:00Z',
    eventTimeType: 'ACTUAL',
    derivedState: 'ACTUAL',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Phase 4-5 — buildTimelineRenderList (block assembly + transshipment)
// ---------------------------------------------------------------------------
describe('buildTimelineRenderList', () => {
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
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

    const voyageBlocks = renderList.filter((r) => r.type === 'voyage-block')
    expect(voyageBlocks).toHaveLength(1)

    const vb = voyageBlocks[0]
    if (vb.type === 'voyage-block') {
      expect(vb.block.vessel).toBe('V1')
      expect(vb.block.origin).toBe('A')
      expect(vb.block.destination).toBe('B')
    }
  })

  it('inserts transshipment block between different voyages', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V2', voyage: 'VY2', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')
    expect(tsBlocks).toHaveLength(1)

    if (tsBlocks[0].type === 'transshipment-block') {
      expect(tsBlocks[0].block.port).toBe('B')
      expect(tsBlocks[0].block.reason).toBe('Vessel and voyage change')
      expect(tsBlocks[0].block.fromVessel).toBe('V1')
      expect(tsBlocks[0].block.toVessel).toBe('V2')
    }
  })

  it('sets transshipment reason to voyage change when vessel is unchanged', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V1', voyage: 'VY2', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))
    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')

    expect(tsBlocks).toHaveLength(1)
    if (tsBlocks[0].type === 'transshipment-block') {
      expect(tsBlocks[0].block.reason).toBe('Voyage change')
    }
  })

  it('sets transshipment reason to vessel change when voyage is unchanged', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V2', voyage: 'VY1', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))
    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')

    expect(tsBlocks).toHaveLength(1)
    if (tsBlocks[0].type === 'transshipment-block') {
      expect(tsBlocks[0].block.reason).toBe('Vessel change')
    }
  })

  it('does NOT insert transshipment when same vessel continues', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DISCHARGE', location: 'B' }),
      makeEvent({ id: 'e3', type: 'LOAD', vesselName: 'V1', voyage: 'VY1', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'C' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

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
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

    const tsBlocks = renderList.filter((r) => r.type === 'transshipment-block')
    expect(tsBlocks).toHaveLength(0)
  })

  it('creates pre-carriage terminal block for events before voyage', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'GATE_IN', location: 'Terminal X' }),
      makeEvent({ id: 'e2', type: 'LOAD', vesselName: 'V1', location: 'Port A' }),
      makeEvent({ id: 'e3', type: 'DISCHARGE', location: 'Port B' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

    const termBlocks = renderList.filter((r) => r.type === 'terminal-block')
    expect(termBlocks).toHaveLength(1)

    if (termBlocks[0].type === 'terminal-block') {
      expect(termBlocks[0].block.kind).toBe('pre-carriage')
    }
  })

  it('handles events-only scenario (no voyages) as terminal block', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'GATE_IN', location: 'T1' }),
      makeEvent({ id: 'e2', type: 'GATE_OUT', location: 'T1' }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-02'))

    const termBlocks = renderList.filter((r) => r.type === 'terminal-block')
    expect(termBlocks.length).toBeGreaterThanOrEqual(1)
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
        eventTimeIso: '2026-03-01T00:00:00Z',
        location: 'A',
      }),
      makeEvent({
        id: 'e2',
        type: 'ARRIVAL',
        eventTimeIso: '2026-03-04T00:00:00Z',
        location: 'B',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-05'))

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    expect(gaps).toHaveLength(1)

    if (gaps[0].type === 'gap-marker') {
      expect(gaps[0].marker.kind).toBe('transit')
      expect(gaps[0].marker.durationDays).toBe(3)
    }
  })

  it('inserts a generic gap marker for non-vessel events', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'GATE_IN',
        eventTimeIso: '2026-03-01T00:00:00Z',
        location: 'T',
      }),
      makeEvent({
        id: 'e2',
        type: 'GATE_OUT',
        eventTimeIso: '2026-03-04T00:00:00Z',
        location: 'T',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-05'))

    const gaps = renderList.filter((r) => r.type === 'gap-marker')
    expect(gaps).toHaveLength(1)

    if (gaps[0].type === 'gap-marker') {
      expect(gaps[0].marker.kind).toBe('generic')
    }
  })

  it('does NOT insert gap marker for short intervals', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'GATE_IN',
        eventTimeIso: '2026-03-01T00:00:00Z',
      }),
      makeEvent({
        id: 'e2',
        type: 'GATE_OUT',
        eventTimeIso: '2026-03-02T00:00:00Z',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-03'))

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
        eventTimeIso: '2026-03-01T00:00:00Z',
        location: 'Port X',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTimeIso: '2026-03-04T00:00:00Z',
        location: 'Port X',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-05'))

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(1)

    if (risks[0].type === 'port-risk-marker') {
      expect(risks[0].marker.durationDays).toBe(3)
      expect(risks[0].marker.ongoing).toBe(false)
      expect(risks[0].marker.severity).toBe('warning')
    }
  })

  it('inserts ongoing port risk marker when no exit event', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTimeIso: '2026-03-01T00:00:00Z',
        location: 'Port Y',
      }),
    ]
    const now = new Date('2026-03-06T00:00:00Z')
    const renderList = buildTimelineRenderList(events, now)

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(1)

    if (risks[0].type === 'port-risk-marker') {
      expect(risks[0].marker.durationDays).toBe(5)
      expect(risks[0].marker.ongoing).toBe(true)
      expect(risks[0].marker.severity).toBe('danger')
    }
  })

  it('applies correct severity levels', () => {
    // 2 days = warning
    const events2d = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTimeIso: '2026-03-01T00:00:00Z',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTimeIso: '2026-03-03T00:00:00Z',
      }),
    ]
    const risks2d = buildTimelineRenderList(events2d, new Date('2026-03-04')).filter(
      (r) => r.type === 'port-risk-marker',
    )
    expect(risks2d).toHaveLength(1)
    if (risks2d[0].type === 'port-risk-marker') {
      expect(risks2d[0].marker.severity).toBe('warning')
    }

    // 4 days = danger
    const events4d = [
      makeEvent({
        id: 'e3',
        type: 'ARRIVAL',
        eventTimeIso: '2026-03-01T00:00:00Z',
      }),
      makeEvent({
        id: 'e4',
        type: 'DISCHARGE',
        eventTimeIso: '2026-03-05T00:00:00Z',
      }),
    ]
    const risks4d = buildTimelineRenderList(events4d, new Date('2026-03-06')).filter(
      (r) => r.type === 'port-risk-marker',
    )
    expect(risks4d).toHaveLength(1)
    if (risks4d[0].type === 'port-risk-marker') {
      expect(risks4d[0].marker.severity).toBe('danger')
    }
  })

  it('suppresses generic gap marker when port risk marker covers the same interval (Phase 19)', () => {
    const events = [
      makeEvent({
        id: 'e1',
        type: 'ARRIVAL',
        eventTimeIso: '2026-03-01T00:00:00Z',
        location: 'Port',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTimeIso: '2026-03-04T00:00:00Z',
        location: 'Port',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-05'))

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
        eventTimeIso: '2026-03-01T00:00:00Z',
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        eventTimeIso: '2026-03-02T00:00:00Z',
      }),
    ]
    const renderList = buildTimelineRenderList(events, new Date('2026-03-03'))

    const risks = renderList.filter((r) => r.type === 'port-risk-marker')
    expect(risks).toHaveLength(0)
  })
})
