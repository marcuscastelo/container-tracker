import { describe, expect, it } from 'vitest'
import {
  type ProcessApiResponse,
  presentProcessList,
} from '~/modules/dashboard/application/processListPresenter'

describe('presentProcessList', () => {
  it('maps API response to ProcessSummary array', () => {
    const example: ProcessApiResponse[] = [
      {
        id: 'p1',
        reference: 'REF1',
        operation_type: 'import',
        origin: { display_name: 'Shanghai' },
        destination: { display_name: 'Santos' },
        carrier: 'Maersk',
        bl_reference: null,
        source: 'api',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [
          { id: 'c1', container_number: 'MRKU1111111', carrier_code: null, container_type: null },
        ],
      },
    ]

    const result = presentProcessList(example)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].id).toBe('p1')
    expect(result[0].containerCount).toBe(1)
    expect(result[0].carrier).toBe('Maersk')
  })
})
