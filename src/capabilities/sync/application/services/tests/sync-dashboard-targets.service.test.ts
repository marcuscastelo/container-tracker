import { describe, expect, it, vi } from 'vitest'
import { createSyncDashboardTargetsService } from '~/capabilities/sync/application/services/sync-dashboard-targets.service'

describe('sync-dashboard-targets.service', () => {
  it('classifies eligible, unsupported, and missing-data dashboard targets without throwing', async () => {
    const service = createSyncDashboardTargetsService({
      targetReadPort: {
        fetchProcessById: vi.fn(),
        listActiveProcessesForDashboardSync: vi.fn(async () => [
          { processId: 'process-1', processReference: 'REF-001' },
          { processId: 'process-2', processReference: null },
        ]),
        listActiveProcessIds: vi.fn(),
        listContainersByProcessId: vi.fn(),
        listContainersByProcessIds: vi.fn(async () => ({
          containersByProcessId: new Map([
            [
              'process-1',
              [
                {
                  processId: 'process-1',
                  containerNumber: '  mscu1234567  ',
                  carrierCode: ' MSC ',
                },
                {
                  processId: 'process-1',
                  containerNumber: '   ',
                  carrierCode: 'MSC',
                },
              ],
            ],
            [
              'process-2',
              [
                {
                  processId: 'process-2',
                  containerNumber: 'HAPU1234567',
                  carrierCode: 'hapag',
                },
                {
                  processId: 'process-2',
                  containerNumber: 'MSKU7654321',
                  carrierCode: null,
                },
              ],
            ],
          ]),
        })),
        findContainersByNumber: vi.fn(),
      },
    })

    const result = await service.resolveTargets()

    expect(result).toEqual({
      requestedProcesses: 2,
      requestedContainers: 4,
      eligibleTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          containerNumber: 'MSCU1234567',
          provider: 'msc',
        },
      ],
      skippedTargets: [
        {
          processId: 'process-1',
          processReference: 'REF-001',
          containerNumber: '',
          provider: 'msc',
          reasonCode: 'MISSING_REQUIRED_DATA',
          reasonMessage: 'Missing container number or provider required for dashboard manual sync.',
        },
        {
          processId: 'process-2',
          processReference: null,
          containerNumber: 'HAPU1234567',
          provider: 'hapag',
          reasonCode: 'UNSUPPORTED_PROVIDER',
          reasonMessage: 'Provider is not supported for dashboard manual sync.',
        },
        {
          processId: 'process-2',
          processReference: null,
          containerNumber: 'MSKU7654321',
          provider: 'unknown',
          reasonCode: 'UNSUPPORTED_PROVIDER',
          reasonMessage: 'Provider is not supported for dashboard manual sync.',
        },
      ],
    })
  })
})
