import { describe, expect, it } from 'vitest'
import { toTrackingObservationDTO } from '~/modules/tracking/application/projection/tracking.observation.dto'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'

describe('tracking observation carrier label metadata', () => {
  it('maps carrier_label to carrierLabel in tracking observation DTO', () => {
    const dto = toTrackingObservationDTO({
      id: 'obs-1',
      type: 'OTHER',
      carrier_label: 'Custom Carrier Event',
      event_time: '2026-02-10T10:00:00.000Z',
      event_time_type: 'ACTUAL',
      location_code: null,
      location_display: null,
      vessel_name: null,
      voyage: null,
      created_at: '2026-02-10T10:00:00.000Z',
    })

    expect(dto.carrier_label).toBe('Custom Carrier Event')
  })

  it('keeps carrierLabel undefined when source carrier_label is null', () => {
    const dto = toTrackingObservationDTO({
      id: 'obs-1',
      type: 'OTHER',
      carrier_label: null,
      event_time: '2026-02-10T10:00:00.000Z',
      event_time_type: 'ACTUAL',
      location_code: null,
      location_display: null,
      vessel_name: null,
      voyage: null,
      created_at: '2026-02-10T10:00:00.000Z',
    })

    expect(dto.carrier_label).toBeNull()
  })

  it('propagates carrierLabel into the timeline read model', () => {
    const timeline = deriveTimelineWithSeriesReadModel(
      [
        {
          id: 'obs-1',
          type: 'OTHER',
          carrier_label: 'Evento nao mapeado',
          event_time: '2026-02-10T10:00:00.000Z',
          event_time_type: 'ACTUAL',
          location_code: null,
          location_display: null,
          vessel_name: null,
          voyage: null,
          created_at: '2026-02-10T10:00:00.000Z',
        },
      ],
      new Date('2026-02-11T10:00:00.000Z'),
    )

    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.carrierLabel).toBe('Evento nao mapeado')
  })
})
