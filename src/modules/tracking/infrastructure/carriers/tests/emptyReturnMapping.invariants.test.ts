import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { deriveAlerts } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import { deriveTimelineWithSeriesReadModel } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import { normalizeMaerskSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer'
import { instantFromIsoText, temporalCanonicalText } from '~/shared/time/tests/helpers'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000041'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000042'
const CONTAINER_NUMBER = 'MNBU3094033'

describe('empty-return mapping invariants', () => {
  it('preserves series grouping, safe-first primary, status derivation, and alert derivation', () => {
    const snapshot: Snapshot = {
      id: SNAPSHOT_ID,
      container_id: CONTAINER_ID,
      provider: 'maersk',
      fetched_at: '2026-02-03T11:00:00.000Z',
      payload: {
        containers: [
          {
            container_num: CONTAINER_NUMBER,
            locations: [
              {
                city: 'SANTOS',
                country_code: 'BR',
                location_code: 'BRSSZ',
                events: [
                  {
                    activity: 'Empty Return',
                    event_time: '2026-02-01T10:00:00.000Z',
                    event_time_type: 'EXPECTED',
                  },
                  {
                    activity: 'Container returned empty',
                    event_time: '2026-02-02T10:00:00.000Z',
                    event_time_type: 'ACTUAL',
                  },
                  {
                    activity: 'Container returned',
                    event_time: '2026-02-05T10:00:00.000Z',
                    event_time_type: 'EXPECTED',
                  },
                ],
              },
            ],
          },
        ],
      },
    }

    const drafts = normalizeMaerskSnapshot(snapshot)
    expect(drafts).toHaveLength(3)
    expect(drafts.map((draft) => draft.type)).toEqual(['EMPTY_RETURN', 'EMPTY_RETURN', 'OTHER'])
    expect(drafts[2]?.carrier_label).toBe('Container returned')

    const timeline = deriveTimelineWithSeriesReadModel(
      drafts.map((draft, index) => ({
        id: `obs-${index + 1}`,
        type: draft.type,
        carrier_label: draft.carrier_label ?? undefined,
        event_time: draft.event_time,
        event_time_type: draft.event_time_type,
        location_code: draft.location_code,
        location_display: draft.location_display,
        vessel_name: draft.vessel_name,
        voyage: draft.voyage,
        created_at: temporalCanonicalText(draft.event_time) ?? `2026-02-03T10:00:0${index}.000Z`,
      })),
      instantFromIsoText('2026-02-03T11:00:00.000Z'),
    )

    expect(timeline).toHaveLength(2)

    const emptyReturnSeries = timeline.find((item) => item.type === 'EMPTY_RETURN')
    expect(emptyReturnSeries).toBeDefined()
    expect(emptyReturnSeries?.eventTimeType).toBe('ACTUAL')
    expect(emptyReturnSeries?.carrierLabel).toBe('Container returned empty')
    expect(emptyReturnSeries?.seriesHistory?.classified).toHaveLength(2)

    const unknownSeries = timeline.find((item) => item.type === 'OTHER')
    expect(unknownSeries).toBeDefined()
    expect(unknownSeries?.carrierLabel).toBe('Container returned')

    const domainObservations: Observation[] = drafts.map((draft, index) => ({
      id: `obs-${index + 1}`,
      fingerprint: `fp-${index + 1}`,
      container_id: CONTAINER_ID,
      container_number: draft.container_number,
      type: draft.type,
      event_time: draft.event_time,
      event_time_type: draft.event_time_type,
      location_code: draft.location_code,
      location_display: draft.location_display,
      vessel_name: draft.vessel_name,
      voyage: draft.voyage,
      is_empty: draft.is_empty,
      confidence: draft.confidence,
      provider: draft.provider,
      created_from_snapshot_id: SNAPSHOT_ID,
      carrier_label: draft.carrier_label,
      created_at: temporalCanonicalText(draft.event_time) ?? `2026-02-03T10:00:0${index}.000Z`,
    }))

    const domainTimeline = deriveTimeline(
      CONTAINER_ID,
      CONTAINER_NUMBER,
      domainObservations,
      instantFromIsoText('2026-02-03T11:00:00.000Z'),
    )
    const status = deriveStatus(domainTimeline)
    expect(status).toBe('EMPTY_RETURNED')

    const alerts = deriveAlerts(
      domainTimeline,
      status,
      [],
      false,
      instantFromIsoText('2026-02-03T11:00:00.000Z'),
    )
    expect(alerts).toEqual([])
  })
})
