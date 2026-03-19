import { describe, expect, it } from 'vitest'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeMscSnapshot } from '~/modules/tracking/infrastructure/carriers/normalizers/msc.normalizer'
import delivered from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_delivered.json'
import dischargePod from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_discharge_pod.json'
import initialLoad from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_initial_load.json'
import transshipment from '~/modules/tracking/infrastructure/carriers/tests/fixtures/msc/msc_transshipment.json'

const SNAPSHOT_ID = '00000000-0000-0000-0000-000000000001'
const CONTAINER_ID = '00000000-0000-0000-0000-000000000002'

function makeSnapshot(payload: unknown, fetchedAt: string = '2025-11-17T00:00:00.000Z'): Snapshot {
  return {
    id: SNAPSHOT_ID,
    container_id: CONTAINER_ID,
    provider: 'msc',
    fetched_at: fetchedAt,
    payload,
  }
}

describe('normalizeMscSnapshot', () => {
  describe('initial load fixture', () => {
    it('should produce 3 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      expect(drafts).toHaveLength(3)
    })

    it('should map "Export received at CY" to GATE_IN', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn).toBeDefined()
      expect(gateIn?.container_number).toBe('CXDU2058677')
      expect(gateIn?.location_code).toBe('ITNAP')
      expect(gateIn?.location_display).toBe('NAPLES, IT')
      expect(gateIn?.carrier_label).toBe('Export received at CY')
    })

    it('should map "Empty to Shipper" to GATE_OUT', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      const gateOut = drafts.find((d) => d.type === 'GATE_OUT')
      expect(gateOut).toBeDefined()
      expect(gateOut?.is_empty).toBe(true)
    })

    it('should set provider and snapshot_id on all drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(initialLoad))
      for (const d of drafts) {
        expect(d.provider).toBe('msc')
        expect(d.snapshot_id).toBe(SNAPSHOT_ID)
      }
    })
  })

  describe('transshipment fixture', () => {
    it('should produce 6 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      expect(drafts).toHaveLength(6)
    })

    it('should map "Export Loaded on Vessel" to LOAD', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const loads = drafts.filter((d) => d.type === 'LOAD')
      expect(loads.length).toBeGreaterThanOrEqual(2)
    })

    it('should map "Full Transshipment Discharged" to DISCHARGE', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const discharges = drafts.filter((d) => d.type === 'DISCHARGE')
      expect(discharges.length).toBeGreaterThanOrEqual(1)
    })

    it('should include vessel info for LOAD events', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const load = drafts.find((d) => d.type === 'LOAD' && d.location_code === 'ITNAP')
      expect(load?.vessel_name).toBe('MSC PARIS')
      expect(load?.voyage).toBe('MZ546A')
    })

    it('should NOT include vessel info for GATE_IN/GATE_OUT events', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(transshipment))
      const gateIn = drafts.find((d) => d.type === 'GATE_IN')
      expect(gateIn?.vessel_name).toBeNull()
      expect(gateIn?.voyage).toBeNull()
    })
  })

  describe('discharge at POD fixture', () => {
    it('should produce 8 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(dischargePod))
      expect(drafts).toHaveLength(8)
    })

    it('should have discharge at BRIOA (Itapoá)', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(dischargePod))
      const discharge = drafts.find((d) => d.type === 'DISCHARGE' && d.location_code === 'BRIOA')
      expect(discharge).toBeDefined()
      expect(discharge?.vessel_name).toBe('MSC BIANCA')
    })
  })

  describe('delivered fixture', () => {
    it('should produce 9 observation drafts', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(delivered))
      expect(drafts).toHaveLength(9)
    })

    it('should have a DELIVERY observation', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(delivered))
      const delivery = drafts.find((d) => d.type === 'DELIVERY')
      expect(delivery).toBeDefined()
      expect(delivery?.location_code).toBe('BRIOA')
    })
  })

  describe('invalid payload', () => {
    it('should return empty array for non-MSC payload', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot({ random: 'data' }))
      expect(drafts).toEqual([])
    })

    it('should return empty array for null payload', () => {
      const drafts = normalizeMscSnapshot(makeSnapshot(null))
      expect(drafts).toEqual([])
    })
  })

  describe('EMPTY_RETURN synonym mapping', () => {
    it('maps unambiguous empty-return labels to EMPTY_RETURN and preserves event_time_type derivation', () => {
      const portugueseLabel = 'Devolu\u00E7\u00E3o de cont\u00EAiner vazio'
      const payload = {
        Data: {
          CurrentDate: '02/02/2026',
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: '01/02/2026',
                      Description: 'Empty Return',
                      UnLocationCode: 'BRSSZ',
                      Location: 'SANTOS, BR',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                    {
                      Date: '03/02/2026',
                      Description: 'Container returned empty',
                      UnLocationCode: 'BRSSZ',
                      Location: 'SANTOS, BR',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                    {
                      Date: '02/02/2026',
                      Description: portugueseLabel,
                      UnLocationCode: 'BRSSZ',
                      Location: 'SANTOS, BR',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      const drafts = normalizeMscSnapshot(makeSnapshot(payload, '2026-02-02T00:00:00.000Z'))
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
        Data: {
          CurrentDate: '02/02/2026',
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: '01/02/2026',
                      Description: 'Empty return requested',
                      UnLocationCode: 'BRSSZ',
                      Location: 'SANTOS, BR',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                    {
                      Date: '03/02/2026',
                      Description: 'Container returned',
                      UnLocationCode: 'BRSSZ',
                      Location: 'SANTOS, BR',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      const drafts = normalizeMscSnapshot(makeSnapshot(payload, '2026-02-02T00:00:00.000Z'))
      expect(drafts).toHaveLength(2)

      expect(drafts[0]?.type).toBe('OTHER')
      expect(drafts[0]?.carrier_label).toBe('Empty return requested')
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')

      expect(drafts[1]?.type).toBe('OTHER')
      expect(drafts[1]?.carrier_label).toBe('Container returned')
      expect(drafts[1]?.event_time_type).toBe('EXPECTED')
    })
  })

  it('maps MSC terminal labels to canonical DELIVERY and EMPTY_RETURN', () => {
    const payload = {
      Data: {
        CurrentDate: '12/02/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: 'CXDU2058677',
                Events: [
                  {
                    Date: '10/02/2026',
                    Description: 'Import to consignee',
                    UnLocationCode: 'BRIOA',
                    Location: 'ITAPOA, BR',
                    Detail: ['LADEN'],
                  },
                  {
                    Date: '12/02/2026',
                    Description: 'Empty received at CY',
                    UnLocationCode: 'BRNVT',
                    Location: 'NAVEGANTES, BR',
                    Detail: ['EMPTY'],
                  },
                ],
              },
            ],
          },
        ],
      },
    }

    const drafts = normalizeMscSnapshot(makeSnapshot(payload, '2026-02-12T10:00:00.000Z'))
    expect(drafts).toHaveLength(2)

    expect(drafts[0]?.type).toBe('DELIVERY')
    expect(drafts[0]?.carrier_label).toBe('Import to consignee')
    expect(drafts[0]?.event_time_type).toBe('ACTUAL')
    expect(drafts[0]?.is_empty).toBe(false)

    expect(drafts[1]?.type).toBe('EMPTY_RETURN')
    expect(drafts[1]?.carrier_label).toBe('Empty received at CY')
    expect(drafts[1]?.event_time_type).toBe('ACTUAL')
    expect(drafts[1]?.is_empty).toBe(true)
  })

  it('preserves raw carrier_label text without trimming', () => {
    const payload = {
      Data: {
        CurrentDate: '02/02/2026',
        BillOfLadings: [
          {
            ContainersInfo: [
              {
                ContainerNumber: 'TEST123',
                Events: [
                  {
                    Date: '01/02/2026',
                    Description: '  Export received at CY  ',
                    UnLocationCode: 'BRSSZ',
                    Location: 'SANTOS, BR',
                    Detail: ['MSC SHIP', 'VOY001'],
                  },
                ],
              },
            ],
          },
        ],
      },
    }

    const drafts = normalizeMscSnapshot(makeSnapshot(payload, '2026-02-02T00:00:00.000Z'))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.carrier_label).toBe('  Export received at CY  ')
  })

  describe('ACTUAL vs EXPECTED differentiation', () => {
    it('should mark events with Date <= CurrentDate as ACTUAL', () => {
      // transshipment fixture has CurrentDate='30/11/2025'
      // Event with Date='30/11/2025' should be ACTUAL
      const snapshot = makeSnapshot(transshipment, '2025-12-01T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      const event = drafts.find((d) => d.type === 'LOAD' && d.location_code === 'ITLIV')
      expect(event).toBeDefined()
      expect(event?.event_time_type).toBe('ACTUAL')
    })

    it('should mark events with Date > CurrentDate as EXPECTED', () => {
      // If we have a future event (mock scenario), it should be EXPECTED
      const futurePayload = {
        Data: {
          CurrentDate: '01/12/2025',
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: '15/12/2025', // Future date
                      Description: 'Full Transshipment Loaded',
                      UnLocationCode: 'ITLIV',
                      Location: 'LEGHORN, IT',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
      const snapshot = makeSnapshot(futurePayload, '2025-12-01T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      expect(drafts).toHaveLength(1)
      expect(drafts[0]?.event_time_type).toBe('EXPECTED')
    })

    it('should mark events without Date as EXPECTED', () => {
      const payloadNoDate = {
        Data: {
          CurrentDate: '01/12/2025',
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: null, // No date
                      Description: 'Export received at CY',
                      UnLocationCode: 'ITNAP',
                      Location: 'NAPLES, IT',
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
      const snapshot = makeSnapshot(payloadNoDate, '2025-12-01T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      expect(drafts).toHaveLength(1)
      expect(drafts[0]?.event_time_type).toBe('EXPECTED')
    })

    it('should generate EXPECTED observation from PodEtaDate when future', () => {
      // transshipment fixture has PodEtaDate='15/02/2026' and CurrentDate='30/11/2025'
      const snapshot = makeSnapshot(transshipment, '2025-11-30T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      const etaDraft = drafts.find((d) => d.type === 'ARRIVAL' && d.event_time_type === 'EXPECTED')
      expect(etaDraft).toBeDefined()
      expect(etaDraft?.event_time).toBe('2026-02-15')
      expect(etaDraft?.location_display).toBe('ITAPOA, BR')
      expect(etaDraft?.confidence).toBe('medium')
    })

    it('should NOT generate EXPECTED observation from PodEtaDate if it is in the past', () => {
      // Create a scenario where PodEtaDate is in the past
      const pastEtaPayload = {
        Data: {
          CurrentDate: '20/02/2026', // After the ETA
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  PodEtaDate: '15/02/2026', // Past ETA
                  Events: [],
                },
              ],
              GeneralTrackingInfo: {
                PortOfDischarge: 'ITAPOA, BR',
              },
            },
          ],
        },
      }
      const snapshot = makeSnapshot(pastEtaPayload, '2026-02-20T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      // Should NOT have an ARRIVAL/EXPECTED draft from PodEtaDate
      const etaDraft = drafts.find((d) => d.type === 'ARRIVAL' && d.event_time_type === 'EXPECTED')
      expect(etaDraft).toBeUndefined()
    })

    it('should use snapshot.fetched_at as fallback when CurrentDate is missing', () => {
      const payloadNoCurrentDate = {
        Data: {
          // No CurrentDate field
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: '01/12/2025',
                      Description: 'Export received at CY',
                      UnLocationCode: 'ITNAP',
                      Location: 'NAPLES, IT',
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
      // Snapshot fetched on 05/12/2025 — event is in the past
      const snapshot = makeSnapshot(payloadNoCurrentDate, '2025-12-05T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      expect(drafts).toHaveLength(1)
      expect(drafts[0]?.event_time_type).toBe('ACTUAL')
    })

    it('should set confidence to medium for EXPECTED events', () => {
      const futurePayload = {
        Data: {
          CurrentDate: '01/12/2025',
          BillOfLadings: [
            {
              ContainersInfo: [
                {
                  ContainerNumber: 'TEST123',
                  Events: [
                    {
                      Date: '15/12/2025', // Future
                      Description: 'Full Transshipment Loaded',
                      UnLocationCode: 'ITLIV',
                      Location: 'LEGHORN, IT',
                      Detail: ['MSC SHIP', 'VOY001'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
      const snapshot = makeSnapshot(futurePayload, '2025-12-01T00:00:00.000Z')
      const drafts = normalizeMscSnapshot(snapshot)

      expect(drafts[0]?.event_time_type).toBe('EXPECTED')
      expect(drafts[0]?.confidence).toBe('medium')
    })
  })
})
