import { describe, expect, it } from 'vitest'
import type { TrackingTimelineItem } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import { groupVoyageSegments } from '~/modules/tracking/application/projection/voyageSegments'

function makeEvent(
  overrides: Partial<TrackingTimelineItem> & Pick<TrackingTimelineItem, 'type'>,
): TrackingTimelineItem {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    eventTimeIso: '2026-03-01T00:00:00Z',
    eventTimeType: 'ACTUAL',
    derivedState: 'ACTUAL',
    ...overrides,
  }
}

describe('groupVoyageSegments', () => {
  it('returns empty array for empty events', () => {
    expect(groupVoyageSegments([])).toEqual([])
  })

  it('groups a single voyage (LOAD → events → DISCHARGE)', () => {
    const events = [
      makeEvent({
        type: 'LOAD',
        vesselName: 'MSC PARIS',
        voyage: 'MZ546A',
        location: 'Alexandria',
      }),
      makeEvent({ type: 'DEPARTURE', location: 'Alexandria' }),
      makeEvent({ type: 'ARRIVAL', location: 'Algeciras' }),
      makeEvent({ type: 'DISCHARGE', location: 'Algeciras' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    expect(segments[0].vessel).toBe('MSC PARIS')
    expect(segments[0].voyage).toBe('MZ546A')
    expect(segments[0].origin).toBe('Alexandria')
    expect(segments[0].destination).toBe('Algeciras')
    expect(segments[0].events).toHaveLength(4)
  })

  it('groups two consecutive voyages (transshipment)', () => {
    const events = [
      makeEvent({
        type: 'LOAD',
        vesselName: 'MSC PARIS',
        voyage: 'MZ546A',
        location: 'Alexandria',
      }),
      makeEvent({ type: 'DEPARTURE' }),
      makeEvent({ type: 'ARRIVAL', location: 'Algeciras' }),
      makeEvent({ type: 'DISCHARGE', location: 'Algeciras' }),
      makeEvent({
        type: 'LOAD',
        vesselName: 'MAERSK LAMANAI',
        voyage: 'ML123',
        location: 'Algeciras',
      }),
      makeEvent({ type: 'DEPARTURE' }),
      makeEvent({ type: 'ARRIVAL', location: 'Santos' }),
      makeEvent({ type: 'DISCHARGE', location: 'Santos' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(2)

    expect(segments[0].vessel).toBe('MSC PARIS')
    expect(segments[0].origin).toBe('Alexandria')
    expect(segments[0].destination).toBe('Algeciras')
    expect(segments[0].events).toHaveLength(4)

    expect(segments[1].vessel).toBe('MAERSK LAMANAI')
    expect(segments[1].origin).toBe('Algeciras')
    expect(segments[1].destination).toBe('Santos')
    expect(segments[1].events).toHaveLength(4)
  })

  it('collects pre-voyage events in a vesselless segment', () => {
    const events = [
      makeEvent({ type: 'GATE_IN', location: 'Terminal X' }),
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(2)

    // Pre-voyage segment
    expect(segments[0].vessel).toBeNull()
    expect(segments[0].events).toHaveLength(1)
    expect(segments[0].events[0].type).toBe('GATE_IN')

    // Voyage segment
    expect(segments[1].vessel).toBe('MSC PARIS')
    expect(segments[1].events).toHaveLength(2)
  })

  it('collects post-voyage events in a vesselless segment', () => {
    const events = [
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
      makeEvent({ type: 'DELIVERY', location: 'Warehouse' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(2)

    expect(segments[0].vessel).toBe('MSC PARIS')
    expect(segments[0].events).toHaveLength(2)

    // Post-voyage segment
    expect(segments[1].vessel).toBeNull()
    expect(segments[1].events).toHaveLength(1)
    expect(segments[1].events[0].type).toBe('DELIVERY')
  })

  it('handles voyage without DISCHARGE (in-transit)', () => {
    const events = [
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DEPARTURE' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    expect(segments[0].vessel).toBe('MSC PARIS')
    expect(segments[0].destination).toBeNull()
    expect(segments[0].events).toHaveLength(2)
  })

  it('handles events with no LOAD at all', () => {
    const events = [
      makeEvent({ type: 'GATE_IN', location: 'Terminal' }),
      makeEvent({ type: 'DEPARTURE' }),
      makeEvent({ type: 'ARRIVAL', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    expect(segments[0].vessel).toBeNull()
    expect(segments[0].events).toHaveLength(3)
  })

  it('handles LOAD without vessel name', () => {
    const events = [
      makeEvent({ type: 'LOAD', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    expect(segments[0].vessel).toBeNull()
    expect(segments[0].origin).toBe('Port A')
    expect(segments[0].destination).toBe('Port B')
  })

  it('preserves event order within segments', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DEPARTURE' }),
      makeEvent({ id: 'e3', type: 'ARRIVAL', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'B' }),
    ]

    const segments = groupVoyageSegments(events)
    const ids = segments[0].events.map((e) => e.id)
    expect(ids).toEqual(['e1', 'e2', 'e3', 'e4'])
  })
})
