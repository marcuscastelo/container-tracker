import { describe, expect, it } from 'vitest'
import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

describe('toShipmentDetailVM ARRIVED_AT_POD mapping', () => {
  it('keeps ARRIVED_AT_POD as process-level status', () => {
    const example: ProcessDetailResponse = {
      id: 'proc-arrived',
      tracking_freshness_token: 'token-proc-arrived',
      reference: 'REF-ARRIVED',
      origin: { display_name: 'Tangier' },
      destination: { display_name: 'Santos' },
      carrier: 'maersk',
      source: 'api',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      containers: [
        {
          id: 'c-arrived-1',
          container_number: 'CAIU1234567',
          status: 'ARRIVED_AT_POD',
        },
        {
          id: 'c-arrived-2',
          container_number: 'CAIU7654321',
          status: 'ARRIVED_AT_POD',
        },
      ],
      process_operational: {
        derived_status: 'ARRIVED_AT_POD',
        status_microbadge: null,
        eta_max: null,
        coverage: {
          total: 2,
          with_eta: 0,
        },
      },
      containersSync: [],
      alerts: [],
    }

    const result = toShipmentDetailVM(example)

    expect(result.statusCode).toBe('ARRIVED_AT_POD')
    expect(result.status).toBe('amber-500')
  })
})
