import { describe, expect, it, vi } from 'vitest'
import type { TrackingObservationRow } from '~/modules/tracking/infrastructure/persistence/tracking.row'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('~/shared/supabase/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}))

import { supabaseObservationRepository } from '~/modules/tracking/infrastructure/persistence/supabaseObservationRepository'

function createQuery<T>(data: T) {
  const query = {
    data,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    in: vi.fn(() => query),
  }

  return query
}

function makeObservationRow(
  id: string,
  eventTimeType: 'ACTUAL' | 'EXPECTED',
  createdAt: string,
): TrackingObservationRow {
  return {
    id,
    fingerprint: `fp-${id}`,
    container_id: 'container-1',
    container_number: 'CXDU2058677',
    event_time_type: eventTimeType,
    type: 'LOAD',
    temporal_kind: 'instant',
    event_time_instant: '2026-01-15T10:00:00.000Z',
    event_time: null,
    event_date: null,
    event_time_local: null,
    event_time_zone: null,
    event_time_source: null,
    location_code: 'USNYC',
    location_display: 'New York',
    vessel_name: null,
    voyage: null,
    is_empty: null,
    confidence: 'high',
    provider: 'maersk',
    created_from_snapshot_id: 'snapshot-1',
    carrier_label: null,
    raw_event_time: null,
    created_at: createdAt,
    retroactive: false,
  }
}

describe('supabaseObservationRepository', () => {
  it('uses canonical chronology when sorting container observations', async () => {
    const query = createQuery<TrackingObservationRow[]>([
      makeObservationRow('obs-expected', 'EXPECTED', '2026-01-15T09:00:00.000Z'),
      makeObservationRow('obs-actual', 'ACTUAL', '2026-01-15T11:00:00.000Z'),
    ])

    mocks.from.mockReturnValue(query)

    const observations = await supabaseObservationRepository.findAllByContainerId('container-1')

    expect(mocks.from).toHaveBeenCalledWith('container_observations')
    expect(query.select).toHaveBeenCalled()
    const [selectArg] = query.select.mock.calls[0]
    expect(selectArg).not.toContain('event_time,')
    expect(observations.map((observation) => observation.id)).toEqual([
      'obs-actual',
      'obs-expected',
    ])
    expect(observations.map((observation) => observation.event_time_type)).toEqual([
      'ACTUAL',
      'EXPECTED',
    ])
  })
})
