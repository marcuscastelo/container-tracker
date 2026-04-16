import { describe, expect, it } from 'vitest'
import {
  type CurrentVoyageGroup,
  resolveCurrentVoyage,
  resolveCurrentVoyageIndex,
  toCurrentVoyageGroups,
} from '~/modules/process/ui/timeline/currentVoyage'
import type { TimelineRenderItem } from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

function voyageGroup(
  events: readonly { readonly type: string; readonly eventTimeType: 'ACTUAL' | 'EXPECTED' }[],
): CurrentVoyageGroup {
  return { kind: 'voyage', events }
}

function postCarriageGroup(
  events: readonly { readonly type: string; readonly eventTimeType: 'ACTUAL' | 'EXPECTED' }[],
): CurrentVoyageGroup {
  return {
    kind: 'terminal',
    terminalKind: 'post-carriage',
    events,
  }
}

function timelineItem(
  id: string,
  type: TrackingTimelineItem['type'],
  eventTimeType: TrackingTimelineItem['eventTimeType'],
): TrackingTimelineItem {
  return {
    id,
    type,
    eventTime: null,
    eventTimeType,
    derivedState: eventTimeType === 'ACTUAL' ? 'ACTUAL' : 'ACTIVE_EXPECTED',
  }
}

describe('resolveCurrentVoyageIndex', () => {
  it('returns -1 when post-carriage has ACTUAL events after the last ACTUAL voyage', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      postCarriageGroup([{ type: 'GATE_OUT', eventTimeType: 'ACTUAL' }]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(-1)
  })

  it('returns the active voyage index when a voyage has ACTUAL events without ACTUAL DISCHARGE', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DEPARTURE', eventTimeType: 'ACTUAL' },
      ]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(1)
  })

  it('keeps fallback to last ACTUAL voyage when post-carriage has no ACTUAL events', () => {
    const groups: readonly CurrentVoyageGroup[] = [
      voyageGroup([
        { type: 'LOAD', eventTimeType: 'ACTUAL' },
        { type: 'DISCHARGE', eventTimeType: 'ACTUAL' },
      ]),
      postCarriageGroup([{ type: 'GATE_OUT', eventTimeType: 'EXPECTED' }]),
    ]

    expect(resolveCurrentVoyageIndex(groups)).toBe(0)
  })

  it('treats planned transshipment blocks as neutral while keeping group indexing aligned', () => {
    const renderList: readonly TimelineRenderItem[] = [
      {
        type: 'voyage-block',
        block: {
          blockType: 'voyage',
          vessel: 'MSC ARICA',
          voyage: 'OB610R',
          origin: 'KARACHI, PK',
          destination: 'COLOMBO, LK',
          events: [
            timelineItem('voyage-1-load-block', 'LOAD', 'ACTUAL'),
            timelineItem('voyage-1-discharge-block', 'DISCHARGE', 'ACTUAL'),
          ],
        },
      },
      {
        type: 'event',
        event: {
          id: 'voyage-1-load',
          type: 'LOAD',
          eventTime: null,
          eventTimeType: 'ACTUAL',
          derivedState: 'ACTUAL',
        },
        isLast: false,
      },
      {
        type: 'block-end',
      },
      {
        type: 'planned-transshipment-block',
        block: {
          blockType: 'planned-transshipment',
          port: 'SINGAPORE, SG',
          event: {
            id: 'planned',
            type: 'TRANSSHIPMENT_INTENDED',
            eventTime: null,
            eventTimeType: 'EXPECTED',
            derivedState: 'ACTIVE_EXPECTED',
            location: 'SINGAPORE, SG',
          },
          fromVessel: 'MSC ARICA',
          fromVoyage: 'OB610R',
          toVessel: 'SAO PAULO EXPRESS',
          toVoyage: '2613W',
        },
      },
      {
        type: 'voyage-block',
        block: {
          blockType: 'voyage',
          vessel: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          origin: 'SINGAPORE, SG',
          destination: 'SANTOS, BR',
          events: [
            timelineItem('voyage-2-load-block', 'LOAD', 'ACTUAL'),
            timelineItem('voyage-2-departure-block', 'DEPARTURE', 'ACTUAL'),
          ],
        },
      },
      {
        type: 'event',
        event: {
          id: 'voyage-2-load',
          type: 'LOAD',
          eventTime: null,
          eventTimeType: 'ACTUAL',
          derivedState: 'ACTUAL',
        },
        isLast: false,
      },
      {
        type: 'event',
        event: {
          id: 'voyage-2-departure',
          type: 'DEPARTURE',
          eventTime: null,
          eventTimeType: 'ACTUAL',
          derivedState: 'ACTUAL',
        },
        isLast: true,
      },
      {
        type: 'block-end',
      },
    ]

    const groups = toCurrentVoyageGroups(renderList)

    expect(groups).toEqual([
      {
        kind: 'voyage',
        events: [
          timelineItem('voyage-1-load-block', 'LOAD', 'ACTUAL'),
          timelineItem('voyage-1-discharge-block', 'DISCHARGE', 'ACTUAL'),
        ],
      },
      {
        kind: 'other',
      },
      {
        kind: 'voyage',
        events: [
          timelineItem('voyage-2-load-block', 'LOAD', 'ACTUAL'),
          timelineItem('voyage-2-departure-block', 'DEPARTURE', 'ACTUAL'),
        ],
      },
    ])
    expect(resolveCurrentVoyageIndex(groups)).toBe(2)
    expect(resolveCurrentVoyage(groups)).toEqual({
      index: 2,
      hasAnyActualVoyage: true,
      endedByPostCarriage: false,
      currentVoyageHasActualDischarge: false,
    })
  })
})
