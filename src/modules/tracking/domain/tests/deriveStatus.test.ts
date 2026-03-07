import { describe, expect, it } from 'vitest'
import { deriveStatus } from '~/modules/tracking/domain/derive/deriveStatus'
import { deriveTimeline } from '~/modules/tracking/domain/derive/deriveTimeline'
import type { Observation } from '~/modules/tracking/domain/model/observation'

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

describe('deriveStatus', () => {
  it('should return UNKNOWN for empty timeline', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [])
    expect(deriveStatus(timeline)).toBe('UNKNOWN')
  })

  it('should return IN_PROGRESS for unrecognized event types', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [makeObs({ type: 'OTHER' })])
    expect(deriveStatus(timeline)).toBe('IN_PROGRESS')
  })

  it('should return IN_PROGRESS for GATE_IN events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({ type: 'GATE_IN', id: '00000000-0000-0000-0000-000000000011', fingerprint: 'fp1' }),
    ])
    expect(deriveStatus(timeline)).toBe('IN_PROGRESS')
  })

  it('should return LOADED for LOAD events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({ type: 'GATE_IN', id: '00000000-0000-0000-0000-000000000011', fingerprint: 'fp1' }),
      makeObs({
        type: 'LOAD',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-26T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('LOADED')
  })

  it('should return IN_TRANSIT for DEPARTURE events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({ type: 'LOAD', id: '00000000-0000-0000-0000-000000000012', fingerprint: 'fp2' }),
      makeObs({
        type: 'DEPARTURE',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-11-27T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('IN_TRANSIT')
  })

  it('should return IN_TRANSIT for DISCHARGE -> LOAD -> DEPARTURE (regression)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'DISCHARGE',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-02-13T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-22T00:00:00.000Z',
      }),
      makeObs({
        type: 'DEPARTURE',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2026-02-23T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('IN_TRANSIT')
  })

  it('should return ARRIVED_AT_POD for ARRIVAL events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'ARRIVAL',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-01-20T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('ARRIVED_AT_POD')
  })

  it('should return DISCHARGED for ARRIVAL -> DISCHARGE', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'ARRIVAL',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-02-01T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-02T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('DISCHARGED')
  })

  it('should return LOADED for DISCHARGE -> LOAD', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'DISCHARGE',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-02-13T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2026-02-22T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('LOADED')
  })

  it('should return DELIVERED for DELIVERY events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'DELIVERY',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-02-09T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('DELIVERED')
  })

  it('should derive status from latest ACTUAL when earlier events are also present', () => {
    // Simulate: DELIVERY event exists, but there are also earlier GATE_IN events.
    // Latest ACTUAL remains DELIVERY.
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'GATE_IN',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2025-11-17T00:00:00.000Z',
      }),
      makeObs({
        type: 'DELIVERY',
        id: '00000000-0000-0000-0000-000000000015',
        fingerprint: 'fp5',
        event_time: '2026-02-09T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('DELIVERED')
  })

  it('should handle EMPTY_RETURN events', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'EMPTY_RETURN',
        id: '00000000-0000-0000-0000-000000000011',
        fingerprint: 'fp1',
        event_time: '2026-02-15T00:00:00.000Z',
      }),
    ])
    expect(deriveStatus(timeline)).toBe('EMPTY_RETURNED')
  })

  it('should handle transshipment cycles correctly (LOAD → DISCHARGE → LOAD → DISCHARGE)', () => {
    const timeline = deriveTimeline(CONTAINER_ID, CONTAINER_NUMBER, [
      makeObs({
        type: 'LOAD',
        id: '00000000-0000-0000-0000-000000000012',
        fingerprint: 'fp2',
        event_time: '2025-11-26T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        id: '00000000-0000-0000-0000-000000000013',
        fingerprint: 'fp3',
        event_time: '2025-11-29T00:00:00.000Z',
      }),
      makeObs({
        type: 'LOAD',
        id: '00000000-0000-0000-0000-000000000014',
        fingerprint: 'fp4',
        event_time: '2025-11-30T00:00:00.000Z',
      }),
      makeObs({
        type: 'DISCHARGE',
        id: '00000000-0000-0000-0000-000000000015',
        fingerprint: 'fp5',
        event_time: '2026-01-07T00:00:00.000Z',
      }),
    ])
    // Latest ACTUAL is DISCHARGE
    expect(deriveStatus(timeline)).toBe('DISCHARGED')
  })
})
