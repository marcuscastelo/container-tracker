import { describe, expect, it } from 'vitest'
import { groupVoyageSegments } from '~/modules/tracking/application/projection/voyageSegments'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function makeEvent(
  overrides: Partial<TrackingTimelineItem> & Pick<TrackingTimelineItem, 'type'>,
): TrackingTimelineItem {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
    eventTimeType: 'ACTUAL',
    derivedState: 'ACTUAL',
    ...overrides,
  }
}

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected value to be defined in test fixture')
  }

  return value
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
    const segment = requireDefined(segments[0])
    expect(segment.vessel).toBe('MSC PARIS')
    expect(segment.voyage).toBe('MZ546A')
    expect(segment.origin).toBe('Alexandria')
    expect(segment.destination).toBe('Algeciras')
    expect(segment.events).toHaveLength(4)
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
    const firstSegment = requireDefined(segments[0])
    const secondSegment = requireDefined(segments[1])

    expect(firstSegment.vessel).toBe('MSC PARIS')
    expect(firstSegment.origin).toBe('Alexandria')
    expect(firstSegment.destination).toBe('Algeciras')
    expect(firstSegment.events).toHaveLength(4)

    expect(secondSegment.vessel).toBe('MAERSK LAMANAI')
    expect(secondSegment.origin).toBe('Algeciras')
    expect(secondSegment.destination).toBe('Santos')
    expect(secondSegment.events).toHaveLength(4)
  })

  it('collects pre-voyage events in a vesselless segment', () => {
    const events = [
      makeEvent({ type: 'GATE_IN', location: 'Terminal X' }),
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(2)
    const preVoyageSegment = requireDefined(segments[0])
    const voyageSegment = requireDefined(segments[1])

    // Pre-voyage segment
    expect(preVoyageSegment.vessel).toBeNull()
    expect(preVoyageSegment.events).toHaveLength(1)
    expect(requireDefined(preVoyageSegment.events[0]).type).toBe('GATE_IN')

    // Voyage segment
    expect(voyageSegment.vessel).toBe('MSC PARIS')
    expect(voyageSegment.events).toHaveLength(2)
  })

  it('collects post-voyage events in a vesselless segment', () => {
    const events = [
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
      makeEvent({ type: 'DELIVERY', location: 'Warehouse' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(2)
    const voyageSegment = requireDefined(segments[0])
    const postVoyageSegment = requireDefined(segments[1])

    expect(voyageSegment.vessel).toBe('MSC PARIS')
    expect(voyageSegment.events).toHaveLength(2)

    // Post-voyage segment
    expect(postVoyageSegment.vessel).toBeNull()
    expect(postVoyageSegment.events).toHaveLength(1)
    expect(requireDefined(postVoyageSegment.events[0]).type).toBe('DELIVERY')
  })

  it('handles voyage without DISCHARGE (in-transit)', () => {
    const events = [
      makeEvent({ type: 'LOAD', vesselName: 'MSC PARIS', location: 'Port A' }),
      makeEvent({ type: 'DEPARTURE' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    const segment = requireDefined(segments[0])
    expect(segment.vessel).toBe('MSC PARIS')
    expect(segment.destination).toBeNull()
    expect(segment.events).toHaveLength(2)
  })

  it('handles events with no LOAD at all', () => {
    const events = [
      makeEvent({ type: 'GATE_IN', location: 'Terminal' }),
      makeEvent({ type: 'DEPARTURE' }),
      makeEvent({ type: 'ARRIVAL', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    const segment = requireDefined(segments[0])
    expect(segment.vessel).toBeNull()
    expect(segment.events).toHaveLength(3)
  })

  it('handles LOAD without vessel name', () => {
    const events = [
      makeEvent({ type: 'LOAD', location: 'Port A' }),
      makeEvent({ type: 'DISCHARGE', location: 'Port B' }),
    ]

    const segments = groupVoyageSegments(events)
    expect(segments).toHaveLength(1)
    const segment = requireDefined(segments[0])
    expect(segment.vessel).toBeNull()
    expect(segment.origin).toBe('Port A')
    expect(segment.destination).toBe('Port B')
  })

  it('keeps predicted voyage events with null vessel identity in the active voyage when voyage matches', () => {
    const events = [
      makeEvent({
        id: 'departure-with-vessel',
        type: 'DEPARTURE',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'MSC PARIS',
        voyage: 'MZ546A',
        location: 'Port A',
      }),
      makeEvent({
        id: 'departure-with-null-vessel',
        type: 'DEPARTURE',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: null,
        voyage: 'MZ546A',
        location: 'Port A',
      }),
      makeEvent({
        id: 'arrival-without-vessel',
        type: 'ARRIVAL',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: null,
        voyage: 'MZ546A',
        location: 'Port B',
      }),
    ]

    const segments = groupVoyageSegments(events)

    expect(segments).toHaveLength(1)
    const segment = requireDefined(segments[0])
    expect(segment.vessel).toBe('MSC PARIS')
    expect(segment.voyage).toBe('MZ546A')
    expect(segment.events).toHaveLength(3)
  })

  it('creates a planned continuation segment after actual discharge plus intended transshipment', () => {
    const events = [
      makeEvent({
        id: 'leg-a-load',
        type: 'LOAD',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        location: 'Karachi',
      }),
      makeEvent({
        id: 'leg-a-discharge',
        type: 'DISCHARGE',
        location: 'Singapore',
      }),
      makeEvent({
        id: 'planned-intended',
        type: 'TRANSSHIPMENT_INTENDED',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'Singapore',
      }),
      makeEvent({
        id: 'planned-arrival',
        type: 'ARRIVAL',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'Santos',
      }),
      makeEvent({
        id: 'planned-discharge',
        type: 'DISCHARGE',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'Santos',
      }),
    ]

    const segments = groupVoyageSegments(events)

    expect(segments).toHaveLength(2)
    const plannedSegment = requireDefined(segments[1])
    expect(plannedSegment.vessel).toBeNull()
    expect(plannedSegment.voyage).toBeNull()
    expect(plannedSegment.origin).toBe('Singapore')
    expect(plannedSegment.destination).toBe('Santos')
    expect(plannedSegment.plannedContinuation).toBe(true)
    expect(plannedSegment.events.map((event) => event.type)).toEqual([
      'TRANSSHIPMENT_INTENDED',
      'ARRIVAL',
      'DISCHARGE',
    ])
  })

  it('keeps explicit future legs stronger than intended transshipment anchors', () => {
    const events = [
      makeEvent({
        id: 'leg-a-load',
        type: 'LOAD',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        location: 'Karachi',
      }),
      makeEvent({
        id: 'leg-a-discharge',
        type: 'DISCHARGE',
        location: 'Singapore',
      }),
      makeEvent({
        id: 'planned-intended',
        type: 'TRANSSHIPMENT_INTENDED',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'Singapore',
      }),
      makeEvent({
        id: 'leg-b-load',
        type: 'LOAD',
        vesselName: 'SAO PAULO EXPRESS',
        voyage: 'SPX001',
        location: 'Singapore',
      }),
      makeEvent({
        id: 'leg-b-arrival',
        type: 'ARRIVAL',
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'SAO PAULO EXPRESS',
        voyage: 'SPX001',
        location: 'Santos',
      }),
    ]

    const segments = groupVoyageSegments(events)

    expect(segments).toHaveLength(3)
    expect(requireDefined(segments[1]).plannedContinuation).toBe(false)
    expect(requireDefined(segments[1]).events.map((event) => event.type)).toEqual([
      'TRANSSHIPMENT_INTENDED',
    ])

    const explicitLeg = requireDefined(segments[2])
    expect(explicitLeg.plannedContinuation).toBe(false)
    expect(explicitLeg.vessel).toBe('SAO PAULO EXPRESS')
    expect(explicitLeg.origin).toBe('Singapore')
    expect(explicitLeg.destination).toBe('Santos')
  })

  it('preserves event order within segments', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'LOAD', vesselName: 'V1', location: 'A' }),
      makeEvent({ id: 'e2', type: 'DEPARTURE' }),
      makeEvent({ id: 'e3', type: 'ARRIVAL', location: 'B' }),
      makeEvent({ id: 'e4', type: 'DISCHARGE', location: 'B' }),
    ]

    const segments = groupVoyageSegments(events)
    const ids = requireDefined(segments[0]).events.map((e) => e.id)
    expect(ids).toEqual(['e1', 'e2', 'e3', 'e4'])
  })
})
