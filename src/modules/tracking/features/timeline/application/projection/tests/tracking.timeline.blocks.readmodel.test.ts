import { describe, expect, it } from 'vitest'
import type { TrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { buildTimelineRenderList } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import {
  instantFromIsoText,
  temporalDtoFromCanonical,
  temporalValueFromCanonical,
} from '~/shared/time/tests/helpers'

function makeEvent(
  overrides: Partial<TrackingTimelineItem> & Pick<TrackingTimelineItem, 'id' | 'type'>,
): TrackingTimelineItem {
  const { id, type, eventTime, eventTimeType, derivedState, ...rest } = overrides

  return {
    id,
    type,
    eventTime:
      eventTime === undefined ? temporalDtoFromCanonical('2026-03-01T00:00:00Z') : eventTime,
    eventTimeType: eventTimeType ?? 'ACTUAL',
    derivedState: derivedState ?? 'ACTUAL',
    ...rest,
  }
}

type ObservationOverrides = Omit<Partial<TrackingObservationProjection>, 'event_time'> &
  Pick<TrackingObservationProjection, 'id' | 'type'> & {
    readonly event_time?: string | TrackingObservationProjection['event_time']
  }

function resolveObservationEventTime(
  value: ObservationOverrides['event_time'],
): TrackingObservationProjection['event_time'] {
  if (typeof value === 'string') return temporalValueFromCanonical(value)
  if (value === undefined) return null
  return value
}

function makeObservation(overrides: ObservationOverrides): TrackingObservationProjection {
  const { id, type, event_time } = overrides

  return {
    id,
    type,
    carrier_label: overrides.carrier_label ?? null,
    event_time: resolveObservationEventTime(event_time),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? null,
    location_display: overrides.location_display ?? null,
    vessel_name: overrides.vessel_name ?? null,
    voyage: overrides.voyage ?? null,
    created_at: overrides.created_at ?? '2026-04-11T17:16:13.887Z',
  }
}

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected value to be defined in test fixture')
  }

  return value
}

function assertSaoPauloFutureLeg(renderList: ReturnType<typeof buildTimelineRenderList>): void {
  const postCarriageBlocks = renderList.filter(
    (item) => item.type === 'terminal-block' && item.block.kind === 'post-carriage',
  )
  const plannedTransshipment = renderList.find(
    (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
  )
  const futureLeg = renderList
    .filter((item) => item.type === 'voyage-block')
    .find(
      (item) =>
        item.type === 'voyage-block' &&
        item.block.vessel === 'SAO PAULO EXPRESS' &&
        item.block.voyage === '2613W',
    )

  expect(postCarriageBlocks).toHaveLength(0)
  expect(plannedTransshipment).toBeDefined()
  expect(futureLeg).toBeDefined()

  if (plannedTransshipment?.type === 'transshipment-block') {
    expect(plannedTransshipment.block.port).toBe('SINGAPORE, SG')
    expect(plannedTransshipment.block.handoffDisplayMode).toBe('FULL')
    expect(plannedTransshipment.block.previousVesselName).toBe('GSL VIOLETTA')
    expect(plannedTransshipment.block.previousVoyage).toBe('ZF609R')
    expect(plannedTransshipment.block.nextVesselName).toBe('SAO PAULO EXPRESS')
    expect(plannedTransshipment.block.nextVoyage).toBe('2613W')
  }

  if (futureLeg?.type === 'voyage-block') {
    expect(futureLeg.block.origin).toBe('SINGAPORE, SG')
    expect(futureLeg.block.destination).toBe('SANTOS, BR')
    expect(futureLeg.block.events.map((event) => event.id)).toContain('santos-arrival-expected')
  }
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
  it('derives a full confirmed handoff for a healthy real transshipment', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'voyage-a-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-01-02'),
          vesselName: 'MSC IRIS',
          voyage: 'QS551R',
          location: 'KARACHI, PK',
        }),
        makeEvent({
          id: 'voyage-a-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-02-10'),
          vesselName: 'MSC IRIS',
          voyage: 'UX604A',
          location: 'BUSAN, KR',
        }),
        makeEvent({
          id: 'voyage-b-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-02-28'),
          vesselName: 'MSC BIANCA SILVIA',
          voyage: 'UX605A',
          location: 'BUSAN, KR',
        }),
        makeEvent({
          id: 'voyage-b-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-05-08'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'MSC BIANCA SILVIA',
          voyage: 'UX614R',
          location: 'SANTOS, BR',
        }),
      ],
      instantFromIsoText('2026-03-20T00:00:00.000Z'),
    )

    const confirmedTransshipment = renderList.find(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'confirmed',
    )

    expect(confirmedTransshipment).toBeDefined()

    if (confirmedTransshipment?.type === 'transshipment-block') {
      expect(confirmedTransshipment.block.port).toBe('BUSAN, KR')
      expect(confirmedTransshipment.block.handoffDisplayMode).toBe('FULL')
      expect(confirmedTransshipment.block.previousVesselName).toBe('MSC IRIS')
      expect(confirmedTransshipment.block.nextVesselName).toBe('MSC BIANCA SILVIA')
    }
  })

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
      expect(plannedTransshipment.block.handoffDisplayMode).toBe('NONE')
      expect(plannedTransshipment.block.previousVesselName).toBe('MSC MIRAYA V')
      expect(plannedTransshipment.block.nextVesselName).toBeNull()
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

  it('keeps GLDU2928252 Santos arrival expected inside the future maritime leg', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'gsl-violetta-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-31'),
          vesselName: 'GSL VIOLETTA',
          voyage: 'ZF609R',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'gsl-violetta-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-04-07'),
          vesselName: 'GSL VIOLETTA',
          voyage: 'ZF609R',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'sao-paulo-transshipment-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: temporalDtoFromCanonical('2026-04-11'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'santos-arrival-expected',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-05-06'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SANTOS, BR',
        }),
      ],
      instantFromIsoText('2026-04-11T00:00:00.000Z'),
    )

    const voyageBlocks = renderList.filter((item) => item.type === 'voyage-block')
    const postCarriageBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'post-carriage',
    )
    const plannedTransshipment = renderList.find(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )

    expect(voyageBlocks).toHaveLength(2)
    expect(postCarriageBlocks).toHaveLength(0)
    expect(plannedTransshipment).toBeDefined()

    const previousLeg = requireDefined(voyageBlocks[0])
    if (previousLeg.type === 'voyage-block') {
      expect(previousLeg.block.vessel).toBe('GSL VIOLETTA')
      expect(previousLeg.block.voyage).toBe('ZF609R')
      expect(previousLeg.block.origin).toBe('COLOMBO, LK')
      expect(previousLeg.block.destination).toBe('SINGAPORE, SG')
      expect(previousLeg.block.events.map((event) => event.id)).toEqual([
        'gsl-violetta-load',
        'gsl-violetta-discharge',
      ])
    }

    if (plannedTransshipment?.type === 'transshipment-block') {
      expect(plannedTransshipment.block.port).toBe('SINGAPORE, SG')
      expect(plannedTransshipment.block.handoffDisplayMode).toBe('FULL')
      expect(plannedTransshipment.block.previousVesselName).toBe('GSL VIOLETTA')
      expect(plannedTransshipment.block.previousVoyage).toBe('ZF609R')
      expect(plannedTransshipment.block.nextVesselName).toBe('SAO PAULO EXPRESS')
      expect(plannedTransshipment.block.nextVoyage).toBe('2613W')
    }

    const futureLeg = requireDefined(voyageBlocks[1])
    if (futureLeg.type === 'voyage-block') {
      expect(futureLeg.block.vessel).toBe('SAO PAULO EXPRESS')
      expect(futureLeg.block.voyage).toBe('2613W')
      expect(futureLeg.block.origin).toBe('SINGAPORE, SG')
      expect(futureLeg.block.destination).toBe('SANTOS, BR')
      expect(futureLeg.block.events.map((event) => event.id)).toEqual(['santos-arrival-expected'])
    }
  })

  it('keeps GLDU2928252 planned leg when expected event times are missing', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'gsl-violetta-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-31'),
          vesselName: 'GSL VIOLETTA',
          voyage: 'ZF609R',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'gsl-violetta-discharge',
          type: 'DISCHARGE',
          eventTime: temporalDtoFromCanonical('2026-04-07'),
          vesselName: 'GSL VIOLETTA',
          voyage: 'ZF609R',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'santos-arrival-expected',
          type: 'ARRIVAL',
          eventTime: null,
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SANTOS, BR',
        }),
        makeEvent({
          id: 'sao-paulo-transshipment-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: null,
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SINGAPORE, SG',
        }),
      ],
      instantFromIsoText('2026-04-11T17:16:13.887Z'),
    )

    assertSaoPauloFutureLeg(renderList)
  })

  it('keeps GLDU2928252 planned leg when the intended transshipment date has expired', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        makeObservation({
          id: 'gsl-violetta-load',
          type: 'LOAD',
          event_time: '2026-03-31',
          event_time_type: 'ACTUAL',
          location_code: 'LKCMB',
          location_display: 'COLOMBO, LK',
          vessel_name: 'GSL VIOLETTA',
          voyage: 'ZF609R',
        }),
        makeObservation({
          id: 'gsl-violetta-discharge',
          type: 'DISCHARGE',
          event_time: '2026-04-07',
          event_time_type: 'ACTUAL',
          location_code: null,
          location_display: 'SINGAPORE, SG',
          vessel_name: 'GSL VIOLETTA',
          voyage: 'ZF609R',
        }),
        makeObservation({
          id: 'sao-paulo-transshipment-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          event_time: '2026-04-11',
          event_time_type: 'EXPECTED',
          location_code: 'SGSIN',
          location_display: 'SINGAPORE, SG',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
        }),
        makeObservation({
          id: 'santos-arrival-expected',
          type: 'ARRIVAL',
          event_time: '2026-05-06',
          event_time_type: 'EXPECTED',
          location_code: 'BRSSZ',
          location_display: 'SANTOS, BR',
          vessel_name: 'SAO PAULO EXPRESS',
          voyage: '2613W',
        }),
      ],
      instantFromIsoText('2026-04-12T00:30:00.000Z'),
    )

    const renderList = buildTimelineRenderList(
      timeline,
      instantFromIsoText('2026-04-12T00:30:00.000Z'),
    )

    assertSaoPauloFutureLeg(renderList)
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
    const confirmedTransshipment = renderList.find(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'confirmed',
    )
    const plannedTransshipmentBlocks = renderList.filter(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )

    expect(voyageBlocks).toHaveLength(2)
    expect(transshipmentTerminal).toHaveLength(1)
    expect(plannedTransshipmentBlocks).toHaveLength(0)
    expect(confirmedTransshipment).toBeDefined()

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

    if (confirmedTransshipment?.type === 'transshipment-block') {
      expect(confirmedTransshipment.block.handoffDisplayMode).toBe('FULL')
      expect(confirmedTransshipment.block.previousVesselName).toBe('MSC MIRAYA V')
      expect(confirmedTransshipment.block.nextVesselName).toBe('SAO PAULO EXPRESS')
    }
  })

  it('renders a full planned handoff before an expected explicit future leg', () => {
    const renderList = buildTimelineRenderList(
      [
        makeEvent({
          id: 'leg-a-load',
          type: 'LOAD',
          eventTime: temporalDtoFromCanonical('2026-03-01T10:00:00Z'),
          vesselName: 'GSL VIOLETTA',
          voyage: 'GSL001',
          location: 'Colombo',
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
          id: 'leg-b-departure',
          type: 'DEPARTURE',
          eventTime: temporalDtoFromCanonical('2026-03-14'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
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

    const plannedTransshipment = renderList.find(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )
    const plannedGapMarker = renderList.find(
      (item) =>
        item.type === 'gap-marker' &&
        item.marker.fromEventType === 'TRANSSHIPMENT_INTENDED' &&
        item.marker.toEventType === 'DEPARTURE',
    )
    const confirmedTransshipment = renderList.find(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'confirmed',
    )
    const futureVoyage = renderList.filter((item) => item.type === 'voyage-block')[1]

    expect(plannedTransshipment).toBeDefined()
    expect(plannedGapMarker).toBeDefined()
    expect(confirmedTransshipment).toBeUndefined()

    if (plannedTransshipment?.type === 'transshipment-block') {
      expect(plannedTransshipment.block.port).toBe('Singapore')
      expect(plannedTransshipment.block.handoffDisplayMode).toBe('FULL')
      expect(plannedTransshipment.block.previousVesselName).toBe('GSL VIOLETTA')
      expect(plannedTransshipment.block.nextVesselName).toBe('SAO PAULO EXPRESS')
    }

    if (plannedGapMarker?.type === 'gap-marker') {
      expect(plannedGapMarker.marker.kind).toBe('generic')
      expect(plannedGapMarker.marker.durationDays).toBe(2)
    }

    if (futureVoyage?.type === 'voyage-block') {
      expect(futureVoyage.block.vessel).toBe('SAO PAULO EXPRESS')
      expect(futureVoyage.block.voyage).toBe('SPX001')
      expect(futureVoyage.block.origin).toBe('Singapore')
      expect(futureVoyage.block.destination).toBe('Santos')
    }

    if (plannedTransshipment !== undefined && plannedGapMarker !== undefined) {
      expect(renderList.indexOf(plannedGapMarker)).toBeGreaterThan(
        renderList.indexOf(plannedTransshipment),
      )
    }
  })

  it('renders a next-only planned handoff when only the upcoming vessel is known', () => {
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
          id: 'leg-b-departure',
          type: 'DEPARTURE',
          eventTime: temporalDtoFromCanonical('2026-04-24'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
          location: 'Singapore',
        }),
        makeEvent({
          id: 'leg-b-arrival',
          type: 'ARRIVAL',
          eventTime: temporalDtoFromCanonical('2026-05-14'),
          eventTimeType: 'EXPECTED',
          derivedState: 'ACTIVE_EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
          location: 'Santos',
        }),
      ],
      instantFromIsoText('2026-04-08T00:00:00.000Z'),
    )

    const plannedTransshipmentBlocks = renderList.filter(
      (item) => item.type === 'transshipment-block' && item.block.mode === 'planned',
    )

    expect(plannedTransshipmentBlocks).toHaveLength(2)

    const singaporeTransshipment = plannedTransshipmentBlocks.find(
      (item) => item.type === 'transshipment-block' && item.block.port === 'Singapore',
    )

    if (singaporeTransshipment?.type === 'transshipment-block') {
      expect(singaporeTransshipment.block.handoffDisplayMode).toBe('NEXT_ONLY')
      expect(singaporeTransshipment.block.previousVesselName).toBeNull()
      expect(singaporeTransshipment.block.nextVesselName).toBe('SAO PAULO EXPRESS')
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

    const plannedPorts = plannedTransshipmentBlocks.map((item) => {
      if (item.type !== 'transshipment-block') {
        return null
      }

      return {
        port: item.block.port,
        mode: item.block.handoffDisplayMode,
        previous: item.block.previousVesselName,
        next: item.block.nextVesselName,
      }
    })

    expect(plannedPorts).toEqual([
      {
        port: 'Colombo',
        mode: 'FULL',
        previous: 'MSC MIRAYA V',
        next: 'MSC RENEE XIII',
      },
      {
        port: 'Singapore',
        mode: 'FULL',
        previous: 'MSC RENEE XIII',
        next: 'ONE MAGDALENA',
      },
    ])
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

    const colomboVoyage = requireDefined(plannedVoyageBlocks[0])
    const singaporeVoyage = requireDefined(plannedVoyageBlocks[1])

    if (colomboVoyage.type === 'voyage-block') {
      expect(colomboVoyage.block.vessel).toBe('MSC RENEE XIII')
      expect(colomboVoyage.block.voyage).toBe('QB609E')
    }

    if (singaporeVoyage.type === 'voyage-block') {
      expect(singaporeVoyage.block.vessel).toBe('ONE MAGDALENA')
      expect(singaporeVoyage.block.voyage).toBe('2616W')
      expect(singaporeVoyage.block.events.map((event) => event.id)).toEqual([
        'planned-santos-arrival-final',
      ])
    }
  })
})
