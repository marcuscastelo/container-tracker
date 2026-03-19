import { describe, expect, it } from 'vitest'
import type { TrackingReplayRunResult } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { buildTrackingTimeTravelReadModel } from '~/modules/tracking/features/replay/application/tracking-time-travel.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

describe('buildTrackingTimeTravelReadModel', () => {
  it('marks ETA and ACTUAL conflict changes in diffFromPrevious as read-model deltas', () => {
    const run: TrackingReplayRunResult = {
      containerId: 'container-1',
      containerNumber: 'MNBU3094033',
      referenceNow: '2026-03-01T12:00:00.000Z',
      totalSnapshots: 2,
      totalObservations: 0,
      totalSteps: 0,
      steps: [],
      checkpoints: [
        {
          snapshotId: 'snapshot-1',
          fetchedAt: '2026-03-01T10:00:00.000Z',
          position: 1,
          containerNumber: 'MNBU3094033',
          state: {
            observations: [],
            series: [],
            timeline: [
              {
                id: 'eta-1',
                type: 'ARRIVAL',
                location: 'SANTOS, BR',
                eventTime: temporalDtoFromCanonical('2026-03-05T12:00:00.000Z'),
                eventTimeType: 'EXPECTED',
                derivedState: 'ACTIVE_EXPECTED',
              },
            ],
            status: 'IN_TRANSIT',
            alerts: [],
          },
        },
        {
          snapshotId: 'snapshot-2',
          fetchedAt: '2026-03-01T11:00:00.000Z',
          position: 2,
          containerNumber: 'MNBU3094033',
          state: {
            observations: [],
            series: [],
            timeline: [
              {
                id: 'eta-2',
                type: 'ARRIVAL',
                location: 'SANTOS, BR',
                eventTime: temporalDtoFromCanonical('2026-03-06T12:00:00.000Z'),
                eventTimeType: 'EXPECTED',
                derivedState: 'ACTIVE_EXPECTED',
                seriesHistory: {
                  hasActualConflict: true,
                  classified: [],
                },
              },
            ],
            status: 'IN_TRANSIT',
            alerts: [],
          },
        },
      ],
      finalState: {
        observations: [],
        series: [],
        timeline: [
          {
            id: 'eta-2',
            type: 'ARRIVAL',
            location: 'SANTOS, BR',
            eventTime: temporalDtoFromCanonical('2026-03-06T12:00:00.000Z'),
            eventTimeType: 'EXPECTED',
            derivedState: 'ACTIVE_EXPECTED',
            seriesHistory: {
              hasActualConflict: true,
              classified: [],
            },
          },
        ],
        status: 'IN_TRANSIT',
        alerts: [],
      },
    }

    const timeTravel = buildTrackingTimeTravelReadModel(run)
    const latestDiff = timeTravel.syncs[1]?.diffFromPrevious

    expect(latestDiff?.kind).toBe('comparison')
    if (!latestDiff || latestDiff.kind !== 'comparison') {
      throw new Error('Expected comparison diff')
    }
    expect(latestDiff.timelineChanged).toBe(true)
    expect(latestDiff.actualConflictAppeared).toBe(true)
  })
})
