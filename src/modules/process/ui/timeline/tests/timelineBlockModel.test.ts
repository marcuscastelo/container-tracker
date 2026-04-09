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

type SameDayTieEventKey = 'load' | 'positionedIn' | 'positionedOut' | 'other'

function makeMscSameDayTransshipmentFixture(
  sameDayOrder: readonly SameDayTieEventKey[],
): readonly TrackingTimelineItem[] {
  const sameDayEventTime = temporalDtoFromCanonical('2026-02-28')
  const sameDayEvents: Record<SameDayTieEventKey, TrackingTimelineItem> = {
    load: makeEvent({
      id: 'same-day-load',
      type: 'LOAD',
      eventTime: sameDayEventTime,
      vesselName: 'MSC BIANCA SILVIA',
      voyage: 'UX605A',
      location: 'BUSAN, KR',
    }),
    positionedIn: makeEvent({
      id: 'same-day-positioned-in',
      type: 'TRANSSHIPMENT_POSITIONED_IN',
      eventTime: sameDayEventTime,
      location: 'BUSAN, KR',
    }),
    positionedOut: makeEvent({
      id: 'same-day-positioned-out',
      type: 'TRANSSHIPMENT_POSITIONED_OUT',
      eventTime: sameDayEventTime,
      location: 'BUSAN, KR',
    }),
    other: makeEvent({
      id: 'same-day-other',
      type: 'OTHER',
      eventTime: sameDayEventTime,
      location: 'BUSAN, KR',
    }),
  }

  return [
    makeEvent({
      id: 'pre-gate-out',
      type: 'GATE_OUT',
      eventTime: temporalDtoFromCanonical('2025-11-30'),
      location: 'FAISALABAD, PK',
    }),
    makeEvent({
      id: 'pre-gate-in',
      type: 'GATE_IN',
      eventTime: temporalDtoFromCanonical('2025-12-30'),
      location: 'KARACHI, PK',
    }),
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
    ...sameDayOrder.map((key) => sameDayEvents[key]),
    makeEvent({
      id: 'voyage-b-arrival-expected',
      type: 'ARRIVAL',
      eventTime: temporalDtoFromCanonical('2026-05-08'),
      eventTimeType: 'EXPECTED',
      derivedState: 'ACTIVE_EXPECTED',
      vesselName: 'MSC BIANCA SILVIA',
      voyage: 'UX614R',
      location: 'SANTOS, BR',
    }),
  ]
}

function makeChainedPlannedFutureFixture(): readonly TrackingTimelineItem[] {
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
      location: 'Singapore',
      vesselName: 'MSC RENEE XIII',
      voyage: 'QB609E',
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

function renderListSignature(
  renderList: ReturnType<typeof buildTimelineRenderList>,
): readonly string[] {
  return renderList.map((item) => {
    switch (item.type) {
      case 'voyage-block':
        return `voyage-block:${item.block.vessel ?? ''}:${item.block.voyage ?? ''}:${item.block.origin ?? ''}:${item.block.destination ?? ''}`
      case 'terminal-block':
        return `terminal-block:${item.block.kind}:${item.block.events.map((event) => event.type).join(',')}`
      case 'transshipment-block':
        return `transshipment-block:${item.block.mode}:${item.block.fromVessel ?? ''}:${item.block.toVessel ?? ''}:${item.block.plannedVessel ?? ''}:${item.block.port ?? ''}`
      case 'event':
        return `event:${item.event.id}:${item.event.type}:${item.isLast ? 'last' : 'mid'}`
      case 'gap-marker':
        return `gap-marker:${item.marker.kind}:${item.marker.fromEventType}:${item.marker.toEventType}:${item.marker.durationDays}`
      case 'port-risk-marker':
        return `port-risk-marker:${item.marker.severity}:${item.marker.durationDays}:${item.marker.ongoing ? 'ongoing' : 'closed'}`
      case 'block-end':
        return 'block-end'
      default:
        return 'unreachable'
    }
  })
}

function describeMainTimelineBlocks(
  renderList: ReturnType<typeof buildTimelineRenderList>,
): readonly string[] {
  return renderList.flatMap((item) => {
    if (item.type === 'voyage-block') {
      return [
        `voyage:${item.block.vessel ?? ''}:${item.block.origin ?? ''}:${item.block.destination ?? ''}`,
      ]
    }
    if (item.type === 'transshipment-block') {
      return [
        `transshipment:${item.block.mode}:${item.block.port ?? ''}:${item.block.plannedVessel ?? ''}`,
      ]
    }
    if (item.type === 'terminal-block') {
      return [`terminal:${item.block.kind}:${item.block.location ?? ''}`]
    }
    return []
  })
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
      makeEvent({
        id: 'e1',
        type: 'LOAD',
        vesselName: 'V1',
        location: 'A',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        type: 'DEPARTURE',
        location: 'A',
        eventTime: temporalDtoFromCanonical('2026-03-02T00:00:00Z'),
      }),
      makeEvent({
        id: 'e3',
        type: 'ARRIVAL',
        location: 'B',
        eventTime: temporalDtoFromCanonical('2026-03-03T00:00:00Z'),
      }),
      makeEvent({
        id: 'e4',
        type: 'DISCHARGE',
        location: 'B',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
      }),
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
        eventTime: temporalDtoFromCanonical('2026-04-01T00:00:00Z'),
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        location: 'KARACHI, PK',
      }),
      makeEvent({
        id: 'e2',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-04-04T00:00:00Z'),
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
      expect(transshipmentBlock.block.reason).toBe('Vessel and voyage change')
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
      expect(transshipmentBlock.block.reason).toBe('Voyage change')
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
      expect(transshipmentBlock.block.reason).toBe('Vessel change')
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
      makeEvent({
        id: 'e1',
        type: 'LOAD',
        vesselName: 'V1',
        voyage: 'VY1',
        location: 'A',
        eventTime: temporalDtoFromCanonical('2026-03-01T00:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        type: 'DISCHARGE',
        location: 'B',
        eventTime: temporalDtoFromCanonical('2026-03-04T00:00:00Z'),
      }),
      makeEvent({
        id: 'e3',
        type: 'TRANSSHIPMENT_INTENDED',
        eventTime: temporalDtoFromCanonical('2026-03-05T00:00:00Z'),
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        location: 'B',
      }),
      makeEvent({
        id: 'e4',
        type: 'TRANSSHIPMENT_POSITIONED_IN',
        eventTime: temporalDtoFromCanonical('2026-03-06T00:00:00Z'),
        location: 'B',
      }),
      makeEvent({
        id: 'e5',
        type: 'DEPARTURE',
        eventTime: temporalDtoFromCanonical('2026-03-07T00:00:00Z'),
        eventTimeType: 'EXPECTED',
        derivedState: 'ACTIVE_EXPECTED',
        vesselName: 'V2',
        voyage: 'VY2',
        location: 'B',
      }),
      makeEvent({
        id: 'e6',
        type: 'ARRIVAL',
        eventTime: temporalDtoFromCanonical('2026-03-10T00:00:00Z'),
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

describe('buildTimelineRenderList planned transshipment rendering', () => {
  it('renders planned continuation banners before the future voyage and hides intended rows inside it', () => {
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
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
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

    expect(renderListSignature(renderList)).toEqual([
      'voyage-block:MSC MIRAYA V:OB612R:Karachi:Singapore',
      'event:leg-a-load:LOAD:mid',
      'gap-marker:transit:LOAD:DISCHARGE:10',
      'event:leg-a-discharge:DISCHARGE:mid',
      'block-end',
      'transshipment-block:planned:::SAO PAULO EXPRESS:Singapore',
      'voyage-block:::Singapore:Santos',
      'event:planned-arrival:ARRIVAL:mid',
      'port-risk-marker:warning:2:closed',
      'event:planned-discharge:DISCHARGE:last',
      'block-end',
    ])
  })

  it('collapses chained future markers into the dominant planned handoff per port', () => {
    const events = [...makeChainedPlannedFutureFixture()]

    const renderList = buildTimelineRenderList(
      events,
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
    expect(describeMainTimelineBlocks(renderList)).toEqual([
      'voyage:MSC MIRAYA V:Karachi:Colombo',
      'transshipment:planned:Colombo:',
      'voyage::Colombo:Singapore',
      'transshipment:planned:Singapore:ONE MAGDALENA',
      'voyage::Singapore:Santos',
    ])
  })
})

describe('buildTimelineRenderList same-day tie-break ordering', () => {
  it('keeps MSC date-only transshipment helpers inside transshipment-terminal blocks', () => {
    const renderList = buildTimelineRenderList(
      makeMscSameDayTransshipmentFixture(['load', 'positionedOut', 'positionedIn']),
      instantFromIsoText('2026-04-02T00:00:00.000Z'),
    )

    const transshipmentTerminalBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )
    const postCarriageBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'post-carriage',
    )

    expect(transshipmentTerminalBlocks).toHaveLength(1)
    expect(postCarriageBlocks).toHaveLength(0)

    const terminalBlock = requireDefined(transshipmentTerminalBlocks[0])
    if (terminalBlock.type === 'terminal-block') {
      expect(terminalBlock.block.events.map((event) => event.type)).toEqual([
        'TRANSSHIPMENT_POSITIONED_IN',
        'TRANSSHIPMENT_POSITIONED_OUT',
      ])
    }
  })

  it('produces identical block output across same-day tie permutations', () => {
    const sameDayOrders: readonly (readonly SameDayTieEventKey[])[] = [
      ['load', 'positionedIn', 'positionedOut'],
      ['positionedOut', 'load', 'positionedIn'],
      ['positionedIn', 'positionedOut', 'load'],
      ['positionedOut', 'positionedIn', 'load'],
    ]

    const signatures = sameDayOrders.map((sameDayOrder) =>
      renderListSignature(
        buildTimelineRenderList(
          makeMscSameDayTransshipmentFixture(sameDayOrder),
          instantFromIsoText('2026-04-02T00:00:00.000Z'),
        ),
      ),
    )

    const baselineSignature = requireDefined(signatures[0])
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(baselineSignature)
    }
  })

  it('keeps transshipment grouping stable when an unknown same-day event is present', () => {
    const renderList = buildTimelineRenderList(
      makeMscSameDayTransshipmentFixture(['load', 'other', 'positionedOut', 'positionedIn']),
      instantFromIsoText('2026-04-02T00:00:00.000Z'),
    )

    const transshipmentTerminalBlocks = renderList.filter(
      (item) => item.type === 'terminal-block' && item.block.kind === 'transshipment-terminal',
    )

    expect(transshipmentTerminalBlocks).toHaveLength(1)

    const terminalBlock = requireDefined(transshipmentTerminalBlocks[0])
    if (terminalBlock.type === 'terminal-block') {
      expect(terminalBlock.block.events.map((event) => event.type)).toEqual([
        'TRANSSHIPMENT_POSITIONED_IN',
        'TRANSSHIPMENT_POSITIONED_OUT',
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
