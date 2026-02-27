import { describe, expect, it, vi } from 'vitest'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'
import { createProcessControllers } from '~/modules/process/interface/http/process.controllers'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { GetContainerSummaryResult } from '~/modules/tracking/application/usecases/get-container-summary.usecase'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'

describe('process controllers', () => {
  it('returns process detail with container operational and process coverage', async () => {
    const process = createProcessEntity({
      id: toProcessId('process-1'),
      reference: toProcessReference('REF-1'),
      origin: 'Shanghai',
      destination: 'Santos',
      carrier: toCarrierCode('msc'),
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      source: toProcessSource('manual'),
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    })

    const processWithContainers = {
      process,
      containers: [
        {
          id: 'container-1',
          processId: 'process-1',
          containerNumber: 'MSCU1234567',
          carrierCode: 'MSC',
        },
        {
          id: 'container-2',
          processId: 'process-1',
          containerNumber: 'MSCU7654321',
          carrierCode: 'MSC',
        },
      ],
    }

    const containerOneSummary: TrackingOperationalSummary = {
      status: 'IN_TRANSIT',
      eta: {
        eventTimeIso: '2026-03-10T12:00:00.000Z',
        eventTimeType: 'EXPECTED',
        state: 'ACTIVE_EXPECTED',
        type: 'ARRIVAL',
        locationCode: 'BRSSZ',
        locationDisplay: 'Santos',
      },
      transshipment: {
        hasTransshipment: true,
        count: 1,
        ports: [{ code: 'ESALG', display: 'Algeciras' }],
      },
      dataIssue: false,
    }

    const containerTwoSummary = createTrackingOperationalSummaryFallback(true)

    const controllers = createProcessControllers({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
        createProcess: vi.fn(async () => ({
          process,
          containers: [],
          warnings: [],
        })),
        findProcessByIdWithContainers: vi.fn(async () => ({
          process: processWithContainers,
        })),
        updateProcess: vi.fn(async () => ({ process: processWithContainers })),
        findProcessById: vi.fn(async () => ({ process })),
        deleteProcess: vi.fn(async () => ({ deleted: true as const })),
      },
      trackingUseCases: {
        getContainerSummary: vi.fn(async (containerId: string, containerNumber: string) => {
          const summary: GetContainerSummaryResult = {
            containerId,
            containerNumber,
            observations: [
              {
                id: `obs-${containerId}`,
                fingerprint: `fp-${containerId}`,
                container_id: containerId,
                container_number: containerNumber,
                type: 'ARRIVAL',
                event_time: '2026-03-10T12:00:00.000Z',
                event_time_type: 'EXPECTED',
                location_code: 'BRSSZ',
                location_display: 'Santos',
                vessel_name: null,
                voyage: null,
                is_empty: null,
                confidence: 'high',
                provider: 'msc',
                created_from_snapshot_id: 'snapshot-1',
                created_at: '2026-02-25T12:00:00.000Z',
              },
            ],
            timeline: {
              container_id: containerId,
              container_number: containerNumber,
              observations: [],
              derived_at: '2026-02-25T12:00:00.000Z',
              holes: [],
            },
            status: 'IN_TRANSIT',
            transshipment: {
              hasTransshipment: false,
              transshipmentCount: 0,
              ports: [],
            },
            alerts: [],
          }

          return summary
        }),
        getContainersSummary: vi.fn(async () => {
          return new Map([
            ['container-1', containerOneSummary],
            ['container-2', containerTwoSummary],
          ])
        }),
      },
    })

    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers).toHaveLength(2)
    expect(body.containers[0]?.operational?.eta?.event_time).toBe('2026-03-10T12:00:00.000Z')
    expect(body.containers[1]?.operational?.data_issue).toBe(true)
    expect(body.process_operational?.eta_max?.event_time).toBe('2026-03-10T12:00:00.000Z')
    expect(body.process_operational?.coverage.total).toBe(2)
    expect(body.process_operational?.coverage.with_eta).toBe(1)
  })
})
