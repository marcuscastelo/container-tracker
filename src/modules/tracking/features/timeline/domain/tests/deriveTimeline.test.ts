import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'

const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'
const CONTAINER_NUMBER = 'CXDU2058677'
const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'

function makeObs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    fingerprint: 'test-fingerprint',
    container_id: CONTAINER_ID,
    container_number: CONTAINER_NUMBER,
    type: 'OTHER',
    event_time: '2025-11-17T00:00:00.000Z',
    event_time_type: 'ACTUAL', // Default to ACTUAL for tests (confirmed events)
    location_code: 'ITNAP',
    location_display: 'NAPLES, IT',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'msc',
    created_from_snapshot_id: SNAPSHOT_ID,
    created_at: '2025-11-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('deriveTimeline', () => {
  it('should return an empty timeline with a missing_data hole for no observations', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [])
    expect(timeline.observations).toHaveLength(0)
    expect(timeline.holes).toHaveLength(1)
    expect(timeline.holes[0]?.reason).toBe('missing_data')
  })

  it('should sort observations by event_time ascending', () => {
    const obs = [
      makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-26T00:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2026-01-07T00:00:00.000Z',
      }),
    ]
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs)
    expect(timeline.observations[0]?.event_time).toBe('2025-11-17T00:00:00.000Z')
    expect(timeline.observations[1]?.event_time).toBe('2025-11-26T00:00:00.000Z')
    expect(timeline.observations[2]?.event_time).toBe('2026-01-07T00:00:00.000Z')
  })

  it('should place observations with null event_time last', () => {
    const obs = [
      makeObs({ id: '00000000-0000-0000-0000-000000000011', fingerprint: 'fp1', event_time: null }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
    ]
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs)
    expect(timeline.observations[0]?.event_time).toBe('2025-11-17T00:00:00.000Z')
    expect(timeline.observations[1]?.event_time).toBeNull()
  })

  it('should detect gaps > 14 days as holes', () => {
    const obs = [
      makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-12-10T00:00:00.000Z',
      }),
    ]
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs)
    expect(timeline.holes).toHaveLength(1)
    expect(timeline.holes[0]?.reason).toBe('gap')
    expect(timeline.holes[0]?.from).toBe('2025-11-17T00:00:00.000Z')
    expect(timeline.holes[0]?.to).toBe('2025-12-10T00:00:00.000Z')
  })

  it('should NOT detect gaps <= 14 days', () => {
    const obs = [
      makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-26T00:00:00.000Z',
      }),
    ]
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs)
    expect(timeline.holes).toHaveLength(0)
  })

  it('should set container_id and container_number', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [])
    expect(timeline.container_id).toBe(CONTAINER_ID)
    expect(timeline.container_number).toBe(CONTAINER_NUMBER)
  })

  it('should set derived_at as a valid ISO string', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [])
    expect(() => new Date(timeline.derived_at)).not.toThrow()
  })

  it('should use created_at as tiebreaker when event_times are equal', () => {
    const obs = [
      makeObs({
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-17T00:00:00.000Z',
        created_at: '2025-11-18T00:00:00.000Z',
      }),
      makeObs({
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
        created_at: '2025-11-17T00:00:00.000Z',
      }),
    ]
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, obs)
    // fp1 was created first, so it should come first
    expect(timeline.observations[0]?.fingerprint).toBe('fp1')
    expect(timeline.observations[1]?.fingerprint).toBe('fp2')
  })
})
