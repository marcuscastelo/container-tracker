import { describe, expect, it } from 'vitest'
import {
  alertRowToDomain,
  alertToInsertRow,
  observationRowToDomain,
  observationToInsertRow,
  snapshotRowToDomain,
  snapshotToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import type {
  TrackingAlertRow,
  TrackingObservationRow,
  TrackingSnapshotRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

// ---------------------------------------------------------------------------
// Observation mappers
// ---------------------------------------------------------------------------

describe('observationRowToDomain', () => {
  const validRow: TrackingObservationRow = {
    id: '11111111-1111-1111-1111-111111111111',
    fingerprint: 'fp-abc',
    container_id: '22222222-2222-2222-2222-222222222222',
    container_number: 'MSKU1234567',
    event_time_type: 'ACTUAL',
    type: 'LOAD',
    temporal_kind: 'instant',
    event_time_instant: '2026-01-15T10:00:00.000Z',
    event_date: null,
    location_code: 'USNYC',
    location_display: 'New York',
    vessel_name: 'MSC Fantasy',
    voyage: 'V001',
    is_empty: false,
    confidence: 'high',
    provider: 'maersk',
    created_from_snapshot_id: '33333333-3333-3333-3333-333333333333',
    carrier_label: 'Loaded on board',
    created_at: '2026-01-15T12:00:00.000Z',
    retroactive: false,
  }

  it('should map a valid row to domain', () => {
    const result = observationRowToDomain(validRow)
    expect(result.id).toBe(validRow.id)
    expect(result.type).toBe('LOAD')
    expect(result.provider).toBe('maersk')
    expect(result.confidence).toBe('high')
    expect(result.event_time_type).toBe('ACTUAL')
    expect(result.carrier_label).toBe('Loaded on board')
  })

  it('should accept TERMINAL_MOVE observation type', () => {
    const result = observationRowToDomain({ ...validRow, type: 'TERMINAL_MOVE' })
    expect(result.type).toBe('TERMINAL_MOVE')
  })

  it('should throw for invalid provider', () => {
    expect(() => observationRowToDomain({ ...validRow, provider: 'invalid' })).toThrow(
      'not a valid provider',
    )
  })

  it('should throw for invalid observation type', () => {
    expect(() => observationRowToDomain({ ...validRow, type: 'UNKNOWN' })).toThrow(
      'not a valid observation type',
    )
  })

  it('should throw for invalid event_time_type', () => {
    expect(() => observationRowToDomain({ ...validRow, event_time_type: 'MAYBE' })).toThrow(
      'not a valid event_time_type',
    )
  })

  it('should throw for invalid confidence', () => {
    expect(() => observationRowToDomain({ ...validRow, confidence: 'ultra' })).toThrow(
      'not a valid confidence',
    )
  })

  it('should handle null event_time', () => {
    const result = observationRowToDomain({
      ...validRow,
      temporal_kind: null,
      event_time_instant: null,
      event_date: null,
      event_time: null,
    })
    expect(result.event_time).toBeNull()
  })
})

describe('observationToInsertRow', () => {
  it('should map domain NewObservation to insert row', () => {
    const obs = {
      fingerprint: 'fp-abc',
      container_id: '22222222-2222-2222-2222-222222222222',
      container_number: 'MSKU1234567',
      event_time_type: 'ACTUAL' as const,
      type: 'LOAD' as const,
      event_time: temporalValueFromCanonical('2026-01-15T10:00:00.000Z'),
      location_code: 'USNYC',
      location_display: 'New York',
      vessel_name: 'MSC Fantasy',
      voyage: 'V001',
      is_empty: false,
      confidence: 'high' as const,
      provider: 'maersk' as const,
      created_from_snapshot_id: '33333333-3333-3333-3333-333333333333',
      carrier_label: 'Loaded on board',
      retroactive: false,
    }

    const row = observationToInsertRow(obs)
    expect(row.fingerprint).toBe(obs.fingerprint)
    expect(row.type).toBe('LOAD')
    expect(row.provider).toBe('maersk')
    expect(row.carrier_label).toBe('Loaded on board')
  })
})

// ---------------------------------------------------------------------------
// Snapshot mappers
// ---------------------------------------------------------------------------

describe('snapshotRowToDomain', () => {
  const validRow: TrackingSnapshotRow = {
    id: '44444444-4444-4444-4444-444444444444',
    container_id: '22222222-2222-2222-2222-222222222222',
    provider: 'msc',
    fetched_at: '2026-01-15T10:00:00.000Z',
    payload: { test: 'data' },
    parse_error: null,
  }

  it('should map a valid row to domain', () => {
    const result = snapshotRowToDomain(validRow)
    expect(result.id).toBe(validRow.id)
    expect(result.provider).toBe('msc')
    expect(result.payload).toEqual({ test: 'data' })
  })

  it('should throw for invalid provider', () => {
    expect(() => snapshotRowToDomain({ ...validRow, provider: 'unknown_carrier' })).toThrow(
      'not a valid provider',
    )
  })

  it('should throw for invalid timestamp', () => {
    expect(() => snapshotRowToDomain({ ...validRow, fetched_at: 'not-a-date' })).toThrow(
      'not a valid timestamp',
    )
  })
})

describe('snapshotToInsertRow', () => {
  it('should map domain NewSnapshot to insert row', () => {
    const snapshot = {
      container_id: '22222222-2222-2222-2222-222222222222',
      provider: 'msc' as const,
      fetched_at: '2026-01-15T10:00:00.000Z',
      payload: { test: 'data' },
      parse_error: null,
    }

    const row = snapshotToInsertRow(snapshot)
    expect(row.container_id).toBe(snapshot.container_id)
    expect(row.provider).toBe('msc')
  })
})

// ---------------------------------------------------------------------------
// Alert mappers
// ---------------------------------------------------------------------------

describe('alertRowToDomain', () => {
  const validRow: TrackingAlertRow = {
    id: '55555555-5555-5555-5555-555555555555',
    container_id: '22222222-2222-2222-2222-222222222222',
    category: 'fact',
    type: 'TRANSSHIPMENT',
    severity: 'warning',
    message_key: 'alerts.transshipmentDetected',
    message_params: {
      port: 'SGSIN',
      fromVessel: 'VESSEL A',
      toVessel: 'VESSEL B',
    },
    detected_at: '2026-01-15T10:00:00.000Z',
    triggered_at: '2026-01-15T12:00:00.000Z',
    source_observation_fingerprints: ['fp-1', 'fp-2'],
    alert_fingerprint: 'TRANSSHIPMENT:fp-1,fp-2',
    retroactive: false,
    provider: 'maersk',
    lifecycle_state: 'ACTIVE',
    acked_at: null,
    acked_by: null,
    acked_source: null,
    resolved_at: null,
    resolved_reason: null,
    created_at: '2026-01-15T12:00:00.000Z',
  }

  it('should map a valid row to domain', () => {
    const result = alertRowToDomain(validRow)
    expect(result.id).toBe(validRow.id)
    expect(result.category).toBe('fact')
    expect(result.type).toBe('TRANSSHIPMENT')
    expect(result.severity).toBe('warning')
    expect(result.message_key).toBe('alerts.transshipmentDetected')
    expect(result.message_params).toEqual({
      port: 'SGSIN',
      fromVessel: 'VESSEL A',
      toVessel: 'VESSEL B',
    })
    expect(result.source_observation_fingerprints).toEqual(['fp-1', 'fp-2'])
    expect(result.alert_fingerprint).toBe('TRANSSHIPMENT:fp-1,fp-2')
  })

  it('should throw for invalid category', () => {
    expect(() => alertRowToDomain({ ...validRow, category: 'invalid' })).toThrow(
      'not a valid alert category',
    )
  })

  it('should throw for invalid alert type', () => {
    expect(() => alertRowToDomain({ ...validRow, type: 'INVALID_TYPE' })).toThrow(
      'not a valid alert type',
    )
  })

  it('should throw for invalid severity', () => {
    expect(() => alertRowToDomain({ ...validRow, severity: 'extreme' })).toThrow(
      'not a valid alert severity',
    )
  })

  it('should handle null provider', () => {
    const result = alertRowToDomain({ ...validRow, provider: null })
    expect(result.provider).toBeNull()
  })

  it('should normalize space-separated timestamps', () => {
    const result = alertRowToDomain({
      ...validRow,
      detected_at: '2026-01-15 10:00:00+00:00',
      triggered_at: '2026-01-15 12:00:00+00:00',
    })
    expect(result.detected_at).toBe('2026-01-15T10:00:00.000Z')
    expect(result.triggered_at).toBe('2026-01-15T12:00:00.000Z')
  })

  it('should handle non-array fingerprints gracefully', () => {
    const result = alertRowToDomain({
      ...validRow,
      source_observation_fingerprints: 'not-an-array',
    })
    expect(result.source_observation_fingerprints).toEqual([])
  })

  it('should map NO_MOVEMENT message metadata fields', () => {
    const result = alertRowToDomain({
      ...validRow,
      category: 'monitoring',
      type: 'NO_MOVEMENT',
      message_key: 'alerts.noMovementDetected',
      message_params: {
        threshold_days: 10,
        days_without_movement: 12,
        days: 12,
        lastEventDate: '2026-01-03',
      },
    })

    expect(result.message_key).toBe('alerts.noMovementDetected')
    expect(result.message_params).toEqual({
      threshold_days: 10,
      days_without_movement: 12,
      days: 12,
      lastEventDate: '2026-01-03',
    })
  })

  it('should fallback NO_MOVEMENT metadata when reading legacy message params', () => {
    const result = alertRowToDomain({
      ...validRow,
      category: 'monitoring',
      type: 'NO_MOVEMENT',
      message_key: 'alerts.noMovementDetected',
      message_params: {
        days: 9,
        lastEventDate: '2026-01-04',
      },
    })

    expect(result.message_key).toBe('alerts.noMovementDetected')
    expect(result.message_params).toEqual({
      threshold_days: 5,
      days_without_movement: 9,
      days: 9,
      lastEventDate: '2026-01-04',
    })
  })

  it('should normalize NO_MOVEMENT threshold_days to the canonical breakpoint policy', () => {
    const result = alertRowToDomain({
      ...validRow,
      category: 'monitoring',
      type: 'NO_MOVEMENT',
      message_key: 'alerts.noMovementDetected',
      message_params: {
        threshold_days: 7,
        days_without_movement: 7,
        days: 7,
        lastEventDate: '2026-01-04',
      },
    })

    expect(result.message_key).toBe('alerts.noMovementDetected')
    expect(result.message_params).toEqual({
      threshold_days: 5,
      days_without_movement: 7,
      days: 7,
      lastEventDate: '2026-01-04',
    })
  })
})

describe('alertToInsertRow', () => {
  it('should map domain NewTrackingAlert to insert row', () => {
    const alert = {
      container_id: '22222222-2222-2222-2222-222222222222',
      category: 'fact' as const,
      type: 'TRANSSHIPMENT' as const,
      severity: 'warning' as const,
      message_key: 'alerts.transshipmentDetected' as const,
      message_params: {
        port: 'SGSIN',
        fromVessel: 'VESSEL A',
        toVessel: 'VESSEL B',
      },
      detected_at: '2026-01-15T10:00:00.000Z',
      triggered_at: '2026-01-15T12:00:00.000Z',
      source_observation_fingerprints: ['fp-1'],
      alert_fingerprint: 'TRANSSHIPMENT:fp-1',
      retroactive: false,
      provider: 'maersk' as const,
      acked_at: null,
      acked_by: null,
      acked_source: null,
    }

    const row = alertToInsertRow(alert)
    expect(row.container_id).toBe(alert.container_id)
    expect(row.category).toBe('fact')
    expect(row.type).toBe('TRANSSHIPMENT')
    expect(row.alert_fingerprint).toBe('TRANSSHIPMENT:fp-1')
  })
})
