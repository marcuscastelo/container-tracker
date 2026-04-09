import { describe, expect, it } from 'vitest'
import { buildTimelineRenderList } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { instantFromIsoText, temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

function makeEvent(
  overrides: Partial<TrackingTimelineItem> & Pick<TrackingTimelineItem, 'id' | 'type'>,
): TrackingTimelineItem {
  const { id, type, eventTime, eventTimeType, derivedState, ...rest } = overrides

  return {
    id,
    type,
    eventTime: eventTime ?? temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
    eventTimeType: eventTimeType ?? 'ACTUAL',
    derivedState: derivedState ?? 'ACTUAL',
    ...rest,
  }
}

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected value to be defined in test fixture')
  }

  return value
}

function makeChainedPlannedFutureEvents(): readonly TrackingTimelineItem[] {
  return [
    makeEvent({
      id: 'leg-a-departure',
      type: 'DEPARTURE',
      eventTime: temporalDtoFromCanonical('2026-04-07'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      vesselName: 'MSC MIRAYA V',
      voyage: 'OB612R',
      location: 'Karachi',
    }),
    makeEvent({
      id: 'leg-a-arrival',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-04-11'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      vesselName: 'MSC MIRAYA V',
      voyage: 'OB612R',
      location: 'Colombo',
    }),
    makeEvent({
      id: 'planned-colombo',
      type: 'TRANSSHIPMENT_INTENDED',
      eventTime: temporalDtoFromCanonical('2026-04-13'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Colombo',
    }),
    makeEvent({
      id: 'planned-singapore-arrival',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-04-18'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Singapore',
    }),
    makeEvent({
      id: 'planned-singapore',
      type: 'TRANSSHIPMENT_INTENDED',
      eventTime: temporalDtoFromCanonical('2026-04-23'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Singapore',
      vesselName: 'ONE MAGDALENA',
      voyage: '2616W',
    }),
    makeEvent({
      id: 'planned-colombo-return',
      type: 'TRANSSHIPMENT_INTENDED',
      eventTime: temporalDtoFromCanonical('2026-04-28'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Colombo',
      vesselName: 'MSC RENEE XIII',
      voyage: 'QB609E',
    }),
    makeEvent({
      id: 'planned-singapore-return-arrival',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-05-01'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      vesselName: 'MSC RENEE XIII',
      voyage: 'QB609E',
      location: 'Singapore',
    }),
    makeEvent({
      id: 'planned-final-singapore',
      type: 'TRANSSHIPMENT_INTENDED',
      eventTime: temporalDtoFromCanonical('2026-05-03'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Singapore',
      vesselName: 'ONE MAGDALENA',
      voyage: '2616W',
    }),
    makeEvent({
      id: 'planned-santos-arrival',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-05-17'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Santos',
    }),
    makeEvent({
      id: 'planned-santos-arrival-final',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-05-27'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      location: 'Santos',
      vesselName: 'ONE MAGDALENA',
      voyage: '2616W',
    }),
  ]
}

describe('tracking.timeline.blocks planned maritime continuation', () => {
  it('keeps intended transshipment continuation inside a generic maritime leg', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'leg-a-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-01T10:00:00Z'),
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'Karachi',
        }),
        makeEvent({
          id: 'leg-a-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-03-11T10:00:00Z'),
          location: 'Singapore',
        }),
        makeEvent({
          id: 'planned-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: temporalDtoFromCanonical('2026-03-12'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'planned-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-04-10'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Santos',
        }),
        makeEvent({
          id: 'planned-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-04-12'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Santos',
        }),
      ],
      instantFromIsoText('2026-03-20T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((item) => item.type === 'voyage-block')
    const postCarriageBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'post-carriage',
    )
    const plannedTransshipmentBlocks = renderList.filter(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )

    expect(voyageBlocks).toHaveLength(2)
    expect(postCarriageBlocks).toHaveLength(0)
    expect(plannedTransshipmentBlocks).toHaveLength(1)

    const plannedTransshipment = requireDefined(plannedTransshipmentBlocks[0])
    if (plannedTransshipment.type === 'transshipment-block') {
      expect(plannedTransshipment.block.port).toBe('Singapore')
      expect(plannedTransshipment.block.events.map((event) => event.type)).toEqual([
        'TRANSSHIPMENT_INTENDED',
      ])
    }

    const plannedVoyage = requireDefined(voyageBlocks[1])
    if (plannedVoyage.type === 'voyage-block') {
      expect(plannedVoyage.block.vessel).toBeNull()
      expect(plannedVoyage.block.voyage).toBeNull()
      expect(plannedVoyage.block.origin).toBe('Singapore')
      expect(plannedVoyage.block.destination).toBe('Santos')
      expect(plannedVoyage.block.events.map((event) => event.type)).toEqual([
        'ARRIVAL',
        'DISCHARGE',
      ])
    }
  })

  it('returns to the explicit-leg path when a stronger next load exists', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'leg-a-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-01T10:00:00Z'),
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'Karachi',
        }),
        makeEvent({
          id: 'leg-a-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-03-11T10:00:00Z'),
          location: 'Singapore',
        }),
        makeEvent({
          id: 'planned-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: temporalDtoFromCanonical('2026-03-12'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'leg-b-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-14'),
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'leg-b-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-04-10'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
          location: 'Santos',
        }),
      ],
      instantFromIsoText('2026-03-20T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((item) => item.type === 'voyage-block')
    const transshipmentTerminal = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )
    const plannedTransshipmentBlocks = renderList.filter(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )

    expect(voyageBlocks).toHaveLength(2)
    expect(transshipmentTerminal).toHaveLength(1)
    expect(plannedTransshipmentBlocks).toHaveLength(0)

    const explicitVoyage = requireDefined(voyageBlocks[1])
    if (explicitVoyage.type === 'voyage-block') {
      expect(explicitVoyage.block.vessel).toBe('SAO PAULO EXPRESS')
      expect(explicitVoyage.block.voyage).toBe('SPX001')
      expect(explicitVoyage.block.origin).toBe('Singapore')
      expect(explicitVoyage.block.destination).toBe('Santos')
    }

    const terminalBlock = requireDefined(transshipmentTerminal[0])
    if (terminalBlock.type === 'terminal-block') {
      expect(terminalBlock.block.events.map((event) => event.type)).toEqual([
        'TRANSSHIPMENT_INTENDED',
      ])
    }
  })

  it('renders intended-only terminal gaps as planned transshipment blocks between maritime legs', () => {
    const renderList = buildTimelineRenderList(
      makeChainedPlannedFutureEvents(),
      instantFromIsoText('2026-04-08T00:00:00.000Z'),
    )

    const plannedTransshipmentBlocks = renderList.filter(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )
    const transshipmentTerminalBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )

    expect(plannedTransshipmentBlocks).toHaveLength(2)
    expect(transshipmentTerminalBlocks).toHaveLength(0)

    const plannedPorts = plannedTransshipmentBlocks.map((item) =>
      item.type === 'transshipment-block' ? item.block.port : null,
    )

    expect(plannedPorts).toEqual(['Colombo', 'Singapore'])
  })

  it('keeps chained expected transshipment continuations out of post-carriage', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'leg-a-departure',
          type: 'DEPARTURE',
          eventTime: temporalDtoFromCanonical('2026-04-07'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'Karachi',
        }),
        makeEvent({
          id: 'leg-a-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-04-11'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'Colombo',
        }),
        makeEvent({
          id: 'planned-colombo',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: temporalDtoFromCanonical('2026-04-13'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Colombo',
        }),
        makeEvent({
          id: 'planned-singapore-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-04-18'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'planned-singapore',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: temporalDtoFromCanonical('2026-04-23'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'planned-santos-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-05-17'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          location: 'Santos',
        }),
      ],
      instantFromIsoText('2026-04-08T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((item) => item.type === 'voyage-block')
    const postCarriageBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'post-carriage',
    )

    expect(voyageBlocks).toHaveLength(3)
    expect(postCarriageBlocks).toHaveLength(0)

    const firstContinuation = requireDefined(voyageBlocks[1])
    if (firstContinuation.type === 'voyage-block') {
      expect(firstContinuation.block.vessel).toBeNull()
      expect(firstContinuation.block.origin).toBe('Colombo')
      expect(firstContinuation.block.destination).toBe('Singapore')
    }

    const secondContinuation = requireDefined(voyageBlocks[2])
    if (secondContinuation.type === 'voyage-block') {
      expect(secondContinuation.block.vessel).toBeNull()
      expect(secondContinuation.block.origin).toBe('Singapore')
      expect(secondContinuation.block.destination).toBe('Santos')
      expect(secondContinuation.block.events.map((event) => event.type)).toEqual(['ARRIVAL'])
    }
  })

  it('suppresses redundant planned terminal leftovers when the next dominant leg is already known', () => {
    const renderList = buildTimelineRenderList(
      makeChainedPlannedFutureEvents(),
      instantFromIsoText('2026-04-08T00:00:00.000Z'),
    )

    const transshipmentTerminalBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )
    const voyageBlocks = renderList.filter((item) => item.type === 'voyage-block')

    expect(transshipmentTerminalBlocks).toHaveLength(0)
    expect(voyageBlocks).toHaveLength(3)

    const plannedVoyageBlocks = voyageBlocks.slice(1)
    for (const block of plannedVoyageBlocks) {
      if (block?.type !== 'voyage-block') continue
      expect(block.block.events.some((event) => event.type === 'TRANSSHIPMENT_INTENDED')).toBe(
        false,
      )
    }
  })
})
