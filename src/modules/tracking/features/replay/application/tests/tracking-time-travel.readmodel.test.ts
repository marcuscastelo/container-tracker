import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { TrackingReplayRunResult } from '~/modules/tracking/features/replay/application/tracking.replay.types'
import { buildTrackingTimeTravelReadModel } from '~/modules/tracking/features/replay/application/tracking-time-travel.readmodel'
import { temporalDtoFromCanonical, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeObservation(
  overrides: Partial<Observation> & Pick<Observation, 'id' | 'type' | 'created_at'>,
): Observation {
  return {
    id: overrides.id,
    fingerprint: overrides.fingerprint ?? `fp-${overrides.id}`,
    container_id: overrides.container_id ?? 'container-1',
    container_number: overrides.container_number ?? 'MNBU3094033',
    type: overrides.type,
    event_time: overrides.event_time ?? temporalValueFromCanonical('2026-03-01T10:00:00.000Z'),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? 'BRSSZ',
    location_display: overrides.location_display ?? 'Santos, BR',
    vessel_name: overrides.vessel_name ?? null,
    voyage: overrides.voyage ?? null,
    is_empty: overrides.is_empty ?? false,
    confidence: overrides.confidence ?? 'high',
    provider: overrides.provider ?? 'maersk',
    created_from_snapshot_id: overrides.created_from_snapshot_id ?? 'snapshot-1',
    carrier_label: overrides.carrier_label ?? null,
    raw_event_time: overrides.raw_event_time ?? null,
    event_time_source: overrides.event_time_source ?? null,
    created_at: overrides.created_at,
    retroactive: overrides.retroactive ?? false,
  }
}

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

  it('derives tracking validation from checkpoint observations without using persisted lifecycle history', () => {
    const deliveryObservation = makeObservation({
      id: 'obs-delivery',
      type: 'DELIVERY',
      event_time: temporalValueFromCanonical('2026-03-01T08:00:00.000Z'),
      created_at: '2026-03-01T08:00:00.000Z',
    })
    const continuationObservation = makeObservation({
      id: 'obs-load',
      type: 'LOAD',
      event_time: temporalValueFromCanonical('2026-03-01T12:00:00.000Z'),
      created_at: '2026-03-01T12:00:00.000Z',
      location_code: 'BRRIO',
      location_display: 'Rio de Janeiro, BR',
      vessel_name: 'MAERSK SEVILLE',
      voyage: '123W',
      created_from_snapshot_id: 'snapshot-2',
    })

    const contaminatedState = {
      observations: [deliveryObservation, continuationObservation],
      series: [],
      timeline: [],
      status: 'IN_TRANSIT' as const,
      alerts: [],
    }

    const run: TrackingReplayRunResult = {
      containerId: 'container-1',
      containerNumber: 'MNBU3094033',
      referenceNow: '2026-03-01T18:00:00.000Z',
      totalSnapshots: 1,
      totalObservations: 2,
      totalSteps: 0,
      steps: [],
      checkpoints: [
        {
          snapshotId: 'snapshot-2',
          fetchedAt: '2026-03-01T12:30:00.000Z',
          position: 1,
          containerNumber: 'MNBU3094033',
          state: contaminatedState,
        },
      ],
      finalState: contaminatedState,
    }

    const timeTravel = buildTrackingTimeTravelReadModel(run)

    expect(timeTravel.syncs[0]?.trackingValidation).toEqual({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'CRITICAL',
    })
  })
})
