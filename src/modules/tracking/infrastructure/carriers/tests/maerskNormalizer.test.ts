import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMaerskSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/maersk.normalizer'
import fullPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/maersk/maersk_full.json'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-03T15:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'maersk',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeMaerskSnapshot', () => {
  describe('full payload fixture', () => {
    it('should produce observation drafts from all events', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      // 4 events at PORT SAID EAST + 2 at TANGER MED + 1 at SANTOS = 7
      expect(drafts).toHaveLength(7)
    })

    it('should extract container number from container_num', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.container_number).toBe('MNBU3094033')
      }
    })

    it('should map "GATE-OUT" to GATE_OUT with empty flag', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut).toBeDefined()
      expect(gateOut?.is_empty).toBe(true)
      expect(gateOut?.location_code).toBe('EGPSDTM')
      expect(gateOut?.carrier_label).toBe('GATE-OUT')
    })

    it('should map "GATE-IN" to GATE_IN', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn).toBeDefined()
      expect(gateIn?.is_empty).toBe(false)
    })

    it('should map "LOAD" with vessel info', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const load = drafts.find((d) => d.type === 'LOAD')
      expect(load).toBeDefined()
      expect(load?.vessel_name).toBe('MAERSK BROWNSVILLE')
      expect(load?.voyage).toBe('603S')
      expect(load?.location_code).toBe('EGPSDTM')
    })

    it('should map "CONTAINER DEPARTURE" to DEPARTURE', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const departures = drafts.filter((d) => d.type === 'DEPARTURE')
      expect(departures.length).toBeGreaterThanOrEqual(1)
      const dep = departures[0]
      expect(dep?.vessel_name).toBe('MAERSK BROWNSVILLE')
    })

    it('should map "CONTAINER ARRIVAL" to ARRIVAL', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const arrivals = drafts.filter((d) => d.type === 'ARRIVAL')
      expect(arrivals.length).toBeGreaterThanOrEqual(1)
    })

    it('should derive location_display from location city and country_code', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut?.location_display).toBe('PORT SAID EAST, EG')
    })

    it('should set EXPECTED events with medium confidence when time is present', () => {
      const payload = {
        containers: [
          {
            container_num: 'MNBU3094033',
            locations: [
              {
                city: 'SANTOS',
                country_code: 'BR',
                location_code: 'BRSSZ',
                events: [
                  {
                    activity: 'CONTAINER ARRIVAL',
                    event_time: '2026-02-05T10:00:00.000Z',
                    event_time_type: 'EXPECTED',
                  },
                ],
              },
            ],
          },
        ],
      }

      const drafts = normalizeMaerskSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(1)
      expect(drafts[0]?.event_time_type).toBe('EXPECTED')
      expect(drafts[0]?.confidence).toBe('medium')
    })

    it('should set ACTUAL events with high confidence when time and location are present', () => {
      const payload = {
        containers: [
          {
            container_num: 'MNBU3094033',
            locations: [
              {
                city: 'SANTOS',
                country_code: 'BR',
                location_code: 'BRSSZ',
                events: [
                  {
                    activity: 'LOAD',
                    event_time: '2026-02-05T10:00:00.000Z',
                    event_time_type: 'ACTUAL',
                    vessel_name: 'MAERSK BROWNSVILLE',
                    voyage_num: '603S',
                  },
                ],
              },
            ],
          },
        ],
      }

      const drafts = normalizeMaerskSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(1)
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')
      expect(drafts[0]?.confidence).toBe('high')
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.provider).toBe('maersk')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })

    it('should NOT include vessel info for GATE_IN/GATE_OUT events', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn?.vessel_name).toBeNull()
      expect(gateIn?.voyage).toBeNull()
    })

    it('should normalize timezone-less event_time values as local datetimes with port timezone', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(fullPayload))

      expect(temporalCanonicalText(drafts[0]?.event_time ?? null)).toBe(
        '2026-01-13T20:15:00.000[Africa/Cairo]',
      )
      expect(drafts[0]?.event_time_source).toBe('carrier_local_port_time')
    })
  })

  describe('EMPTY_RETURN synonym mapping', () => {
    it('maps unequivocal empty return labels and keeps event_time_type logic unchanged', () => {
      const portugueseLabel = 'Devolu\u00E7\u00E3o de cont\u00EAiner vazio'
      const payload = {
        containers: [
          {
            container_num: 'MNBU3094033',
            locations: [
              {
                city: 'SANTOS',
                country_code: 'BR',
                location_code: 'BRSSZ',
                events: [
                  {
                    activity: 'Empty Return',
                    event_time: '2026-02-01T10:00:00.000Z',
                    event_time_type: 'ACTUAL',
                  },
                  {
                    activity: 'Container returned empty',
                    event_time: '2026-02-02T10:00:00.000Z',
                    event_time_type: 'EXPECTED',
                  },
                  {
                    activity: portugueseLabel,
                    event_time: '2026-02-03T10:00:00.000Z',
                    event_time_type: 'ACTUAL',
                  },
                ],
              },
            ],
          },
        ],
      }

      const drafts = normalizeMaerskSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(3)

      expect(drafts[0]?.type).toBe('EMPTY_RETURN')
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')
      expect(drafts[0]?.carrier_label).toBe('Empty Return')

      expect(drafts[1]?.type).toBe('EMPTY_RETURN')
      expect(drafts[1]?.event_time_type).toBe('EXPECTED')
      expect(drafts[1]?.carrier_label).toBe('Container returned empty')

      expect(drafts[2]?.type).toBe('EMPTY_RETURN')
      expect(drafts[2]?.event_time_type).toBe('ACTUAL')
      expect(drafts[2]?.carrier_label).toBe(portugueseLabel)
    })

    it('keeps ambiguous labels as OTHER and preserves carrier_label', () => {
      const payload = {
        containers: [
          {
            container_num: 'MNBU3094033',
            locations: [
              {
                city: 'SANTOS',
                country_code: 'BR',
                location_code: 'BRSSZ',
                events: [
                  {
                    activity: 'Empty return requested',
                    event_time: '2026-02-04T10:00:00.000Z',
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
      }

      const drafts = normalizeMaerskSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(2)

      expect(drafts[0]?.type).toBe('OTHER')
      expect(drafts[0]?.carrier_label).toBe('Empty return requested')
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')

      expect(drafts[1]?.type).toBe('OTHER')
      expect(drafts[1]?.carrier_label).toBe('Container returned')
      expect(drafts[1]?.event_time_type).toBe('EXPECTED')
    })
  })

  it('preserves raw carrier_label text without trimming', () => {
    const payload = {
      containers: [
        {
          container_num: 'MNBU3094033',
          locations: [
            {
              city: 'SANTOS',
              country_code: 'BR',
              location_code: 'BRSSZ',
              events: [
                {
                  activity: '  Carrier Label With Padding  ',
                  event_time: '2026-02-03T10:00:00.000Z',
                  event_time_type: 'ACTUAL',
                },
              ],
            },
          ],
        },
      ],
    }

    const drafts = normalizeMaerskSnapshot(makeSnapshot(payload))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.carrier_label).toBe('  Carrier Label With Padding  ')
  })

  describe('edge cases', () => {
    it('should return empty array for invalid payload', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot(null))
      expect(drafts).toHaveLength(0)
    })

    it('should return empty array for non-object payload', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot('not an object'))
      expect(drafts).toHaveLength(0)
    })

    it('should handle payload with no containers', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot({ origin: {}, destination: {} }))
      expect(drafts).toHaveLength(0)
    })

    it('should handle error marker payload gracefully', () => {
      const drafts = normalizeMaerskSnapshot(makeSnapshot({ _error: true, message: 'timeout' }))
      expect(drafts).toHaveLength(0)
    })
  })
})
