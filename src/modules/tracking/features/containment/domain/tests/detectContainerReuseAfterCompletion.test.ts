import { describe, expect, it } from 'vitest'
import { detectContainerReuseAfterCompletion } from '~/modules/tracking/features/containment/domain/services/detectContainerReuseAfterCompletion'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

type CandidateObservation = Pick<
  Observation,
  'fingerprint' | 'type' | 'event_time' | 'event_time_type' | 'created_at' | 'is_empty'
> & {
  readonly entityId: string
}

function makeObservation(overrides: Partial<CandidateObservation> = {}): CandidateObservation {
  return {
    entityId: overrides.entityId ?? 'observation-1',
    fingerprint: overrides.fingerprint ?? `fingerprint-${overrides.entityId ?? 'observation-1'}`,
    type: overrides.type ?? 'DISCHARGE',
    event_time: overrides.event_time ?? temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    created_at: overrides.created_at ?? '2026-04-03T10:30:00.000Z',
    is_empty: overrides.is_empty ?? false,
  }
}

describe('detectContainerReuseAfterCompletion', () => {
  it('returns null when delivered tracking has no incompatible continuation', () => {
    const detection = detectContainerReuseAfterCompletion([
      makeObservation({
        entityId: 'discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        entityId: 'delivery-1',
        type: 'DELIVERY',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        created_at: '2026-04-02T10:30:00.000Z',
        is_empty: false,
      }),
    ])

    expect(detection).toBeNull()
  })

  it('detects incompatible continuation after delivered', () => {
    const detection = detectContainerReuseAfterCompletion([
      makeObservation({
        entityId: 'discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        entityId: 'delivery-1',
        type: 'DELIVERY',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        created_at: '2026-04-02T10:30:00.000Z',
      }),
      makeObservation({
        entityId: 'arrival-expected-1',
        type: 'ARRIVAL',
        event_time: temporalValueFromCanonical('2026-04-04T10:00:00.000Z'),
        event_time_type: 'EXPECTED',
        created_at: '2026-04-04T10:30:00.000Z',
      }),
    ])

    expect(detection).toEqual({
      reasonCode: 'CONTAINER_REUSED_AFTER_COMPLETION',
      evidenceSummary: 'ARRIVAL EXPECTED appeared after DELIVERED.',
      stateFingerprint: expect.any(String),
    })
  })

  it('detects incompatible continuation after empty return', () => {
    const detection = detectContainerReuseAfterCompletion([
      makeObservation({
        entityId: 'discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        entityId: 'empty-return-1',
        type: 'EMPTY_RETURN',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        created_at: '2026-04-02T10:30:00.000Z',
        is_empty: true,
      }),
      makeObservation({
        entityId: 'load-1',
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-04-05T10:00:00.000Z'),
        created_at: '2026-04-05T10:30:00.000Z',
      }),
    ])

    expect(detection?.reasonCode).toBe('CONTAINER_REUSED_AFTER_COMPLETION')
    expect(detection?.evidenceSummary).toBe('LOAD ACTUAL appeared after EMPTY_RETURNED.')
  })

  it('does not use discharged alone as strong completion', () => {
    const detection = detectContainerReuseAfterCompletion([
      makeObservation({
        entityId: 'discharge-1',
        type: 'DISCHARGE',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        entityId: 'load-1',
        type: 'LOAD',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        created_at: '2026-04-02T10:30:00.000Z',
      }),
    ])

    expect(detection).toBeNull()
  })

  it('does not flag legitimate delivery to empty-return continuation', () => {
    const detection = detectContainerReuseAfterCompletion([
      makeObservation({
        entityId: 'delivery-1',
        type: 'DELIVERY',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        created_at: '2026-04-01T10:30:00.000Z',
      }),
      makeObservation({
        entityId: 'empty-return-1',
        type: 'EMPTY_RETURN',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        created_at: '2026-04-02T10:30:00.000Z',
        is_empty: true,
      }),
    ])

    expect(detection).toBeNull()
  })
})
