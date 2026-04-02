import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeCmaCgmSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/cmacgm.normalizer'
import fullPayload from '~/modules/tracking/infrastructure/carriers/tests/fixtures/cmacgm/cmacgm_full.json'
import { temporalCanonicalText } from '~/shared/time/tests/helpers'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2026-02-03T12:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'cmacgm',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeCmaCgmSnapshot', () => {
  describe('full payload fixture', () => {
    it('should produce observation drafts from all move arrays', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      // 9 PastMoves + 1 CurrentMove + 1 ProvisionalMove = 11
      expect(drafts).toHaveLength(11)
    })

    it('should extract container number from ContainerReference', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.container_number).toBe('FSCU4565494')
      }
    })

    it('should map "Empty to shipper" to GATE_OUT', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT' && d.location_code === 'ESZAZ')
      expect(gateOut).toBeDefined()
    })

    it('should map "Received for export transfer" to GATE_IN', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN' && d.location_code === 'ESZAZ')
      expect(gateIn).toBeDefined()
    })

    it('should map "Loaded on board" to LOAD with vessel info', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const load = drafts.find((d) => d.type === 'LOAD' && d.location_code === 'ESBCN')
      expect(load).toBeDefined()
      expect(load?.vessel_name).toBe('CMA CGM VOLTAIRE')
      expect(load?.voyage).toBe('0DVNTS1MA')
      expect(load?.carrier_label).toBe('Loaded on board')
    })

    it('should map "Vessel Departure" to DEPARTURE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const departures = drafts.filter((d) => d.type === 'DEPARTURE')
      expect(departures.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Vessel Arrival" to ARRIVAL', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const arrivals = drafts.filter((d) => d.type === 'ARRIVAL')
      expect(arrivals.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Discharged in transhipment" to DISCHARGE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const discharge = drafts.find(
        (d) =>
          d.type === 'DISCHARGE' &&
          d.location_code === 'MAPTM' &&
          d.vessel_name === 'CMA CGM VOLTAIRE',
      )
      expect(discharge).toBeDefined()
    })

    it('should map "Discharged" (current move) to DISCHARGE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const discharge = drafts.find((d) => d.type === 'DISCHARGE' && d.location_code === 'BRIGI')
      expect(discharge).toBeDefined()
    })

    it('should map "Train Departure" (provisional) to DEPARTURE', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const trainDep = drafts.find((d) => d.type === 'DEPARTURE' && d.location_code === 'ESTUD')
      expect(trainDep).toBeDefined()
      expect(trainDep?.confidence).toBe('medium') // State=NONE → provisional
    })

    it('should parse MS Date format correctly', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const first = drafts[0]
      expect(first?.event_time).toBeDefined()
      // /Date(1764659520000)/ → 2025-12-02T08:12:00.000Z
      expect(temporalCanonicalText(first?.event_time ?? null)).toContain('2025-12-02')
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      for (const d of drafts) {
        expect(d.provider).toBe('cmacgm')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })

    it('should NOT include vessel info for GATE_OUT events', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(fullPayload))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut?.vessel_name).toBeNull()
      expect(gateOut?.voyage).toBeNull()
    })

    it('preserves CMA local ETA wall-clock semantics for Santos arrival', () => {
      const payload = {
        ContainerReference: 'TGBU7416510',
        ProvisionalMoves: [
          {
            Date: null,
            DateString: 'Fri 24-APR-2026',
            TimeString: '07:00 PM',
            State: 'NONE',
            StatusDescription: 'Vessel Arrival',
            LocationCode: 'BRSSZ',
            Location: 'SANTOS',
            Vessel: 'CMA CGM LISA MARIE',
            Voyage: '0NSN7S1MA',
          },
        ],
      }

      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(payload, '2026-04-02T12:00:00.000Z'))
      expect(drafts).toHaveLength(1)
      expect(temporalCanonicalText(drafts[0]?.event_time ?? null)).toBe(
        '2026-04-24T19:00:00.000[America/Sao_Paulo]',
      )
      expect(drafts[0]?.event_time_type).toBe('EXPECTED')
      expect(drafts[0]?.raw_event_time).toBe('Fri 24-APR-2026 07:00 PM')
      expect(drafts[0]?.event_time_source).toBe('carrier_local_port_time')
    })
  })

  describe('EMPTY_RETURN synonym mapping', () => {
    it('maps unambiguous empty-return labels to EMPTY_RETURN and preserves event_time_type derivation', () => {
      const portugueseLabel = 'Devolu\u00E7\u00E3o de cont\u00EAiner vazio'
      const payload = {
        ContainerReference: 'FSCU4565494',
        PastMoves: [
          {
            DateString: '2026-02-01T10:00:00.000Z',
            State: 'DONE',
            StatusDescription: 'Empty Return',
            LocationCode: 'BRSSZ',
            Location: 'SANTOS, BR',
          },
          {
            DateString: '2026-02-02T10:00:00.000Z',
            State: 'NONE',
            StatusDescription: 'Container returned empty',
            LocationCode: 'BRSSZ',
            Location: 'SANTOS, BR',
          },
          {
            DateString: '2026-02-03T10:00:00.000Z',
            State: 'CURRENT',
            StatusDescription: portugueseLabel,
            LocationCode: 'BRSSZ',
            Location: 'SANTOS, BR',
          },
        ],
      }

      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(3)

      expect(drafts[0]?.type).toBe('EMPTY_RETURN')
      expect(drafts[0]?.carrier_label).toBe('Empty Return')
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')

      expect(drafts[1]?.type).toBe('EMPTY_RETURN')
      expect(drafts[1]?.carrier_label).toBe('Container returned empty')
      expect(drafts[1]?.event_time_type).toBe('EXPECTED')

      expect(drafts[2]?.type).toBe('EMPTY_RETURN')
      expect(drafts[2]?.carrier_label).toBe(portugueseLabel)
      expect(drafts[2]?.event_time_type).toBe('ACTUAL')
    })

    it('keeps ambiguous labels as OTHER and preserves carrier_label', () => {
      const payload = {
        ContainerReference: 'FSCU4565494',
        PastMoves: [
          {
            DateString: '2026-02-01T10:00:00.000Z',
            State: 'DONE',
            StatusDescription: 'Empty return requested',
            LocationCode: 'BRSSZ',
            Location: 'SANTOS, BR',
          },
          {
            DateString: '2026-02-02T10:00:00.000Z',
            State: 'CURRENT',
            StatusDescription: 'Container returned',
            LocationCode: 'BRSSZ',
            Location: 'SANTOS, BR',
          },
        ],
      }

      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(payload))
      expect(drafts).toHaveLength(2)

      expect(drafts[0]?.type).toBe('OTHER')
      expect(drafts[0]?.carrier_label).toBe('Empty return requested')
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')

      expect(drafts[1]?.type).toBe('OTHER')
      expect(drafts[1]?.carrier_label).toBe('Container returned')
      expect(drafts[1]?.event_time_type).toBe('ACTUAL')
    })
  })

  it('maps CMA-CGM terminal labels to canonical DELIVERY and EMPTY_RETURN', () => {
    const payload = {
      ContainerReference: 'FSCU4565494',
      PastMoves: [
        {
          DateString: '2026-02-01T10:00:00.000Z',
          State: 'DONE',
          StatusDescription: 'Container to consignee',
          LocationCode: 'BRSSZ',
          Location: 'SANTOS, BR',
        },
        {
          DateString: '2026-02-02T10:00:00.000Z',
          State: 'DONE',
          StatusDescription: 'Empty in depot',
          LocationCode: 'BRSSZ',
          Location: 'SANTOS, BR',
        },
      ],
    }

    const drafts = normalizeCmaCgmSnapshot(makeSnapshot(payload))
    expect(drafts).toHaveLength(2)

    expect(drafts[0]?.type).toBe('DELIVERY')
    expect(drafts[0]?.carrier_label).toBe('Container to consignee')
    expect(drafts[0]?.event_time_type).toBe('ACTUAL')

    expect(drafts[1]?.type).toBe('EMPTY_RETURN')
    expect(drafts[1]?.carrier_label).toBe('Empty in depot')
    expect(drafts[1]?.event_time_type).toBe('ACTUAL')
  })

  it('preserves raw carrier_label text without trimming', () => {
    const payload = {
      ContainerReference: 'FSCU4565494',
      PastMoves: [
        {
          DateString: '2026-02-01T10:00:00.000Z',
          State: 'DONE',
          StatusDescription: '  Loaded on board  ',
          LocationCode: 'BRSSZ',
          Location: 'SANTOS, BR',
        },
      ],
    }

    const drafts = normalizeCmaCgmSnapshot(makeSnapshot(payload))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.carrier_label).toBe('  Loaded on board  ')
  })

  describe('edge cases', () => {
    it('should return empty array for invalid payload', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot(null))
      expect(drafts).toHaveLength(0)
    })

    it('should return empty array for non-object payload', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot('not an object'))
      expect(drafts).toHaveLength(0)
    })

    it('should handle payload with no moves', () => {
      const drafts = normalizeCmaCgmSnapshot(makeSnapshot({ ContainerReference: 'TEST1234567' }))
      expect(drafts).toHaveLength(0)
    })

    it('should handle error marker payload gracefully', () => {
      const drafts = normalizeCmaCgmSnapshot(
        makeSnapshot({ _error: true, message: 'Request failed with status code 403' }),
      )
      expect(drafts).toHaveLength(0)
    })
  })
})
