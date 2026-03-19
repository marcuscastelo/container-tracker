import { describe, expect, it } from 'vitest'
import { toTrackingObservationProjection } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { instantFromIsoText, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

describe('tracking observation carrier label metadata', () => {
  it('maps carrier_label to carrierLabel in tracking observation projection', () => {
    const projection = toTrackingObservationProjection({
      id: 'obs-1',
      type: 'OTHER',
      carrier_label: 'Custom Carrier Event',
      event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
      event_time_type: 'ACTUAL',
      location_code: null,
      location_display: null,
      vessel_name: null,
      voyage: null,
      created_at: '2026-02-10T10:00:00.000Z',
    })

    expect(projection.carrier_label).toBe('Custom Carrier Event')
  })

  it('keeps carrierLabel undefined when source carrier_label is null', () => {
    const projection = toTrackingObservationProjection({
      id: 'obs-1',
      type: 'OTHER',
      carrier_label: null,
      event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
      event_time_type: 'ACTUAL',
      location_code: null,
      location_display: null,
      vessel_name: null,
      voyage: null,
      created_at: '2026-02-10T10:00:00.000Z',
    })

    expect(projection.carrier_label).toBeNull()
  })

  it('propagates carrierLabel into the timeline read model', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        {
          id: 'obs-1',
          type: 'OTHER',
          carrier_label: 'Evento nao mapeado',
          event_time: temporalValueFromCanonical('2026-02-10T10:00:00.000Z'),
          event_time_type: 'ACTUAL',
          location_code: null,
          location_display: null,
          vessel_name: null,
          voyage: null,
          created_at: '2026-02-10T10:00:00.000Z',
        },
      ],
      instantFromIsoText('2026-02-11T10:00:00.000Z'),
    )

    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.carrierLabel).toBe('Evento nao mapeado')
  })
})
