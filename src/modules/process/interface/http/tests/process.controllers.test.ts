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
import type { ContainerSyncDTO } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'

type GetContainerSummaryMock = (
  containerId: string,
  containerNumber: string,
  podLocationCode?: string | null,
  now?: Date,
  options?: { readonly includeAcknowledgedAlerts?: boolean },
) => Promise<GetContainerSummaryResult>

type GetContainersSyncMetadataMock = (command: {
  readonly containerNumbers: readonly string[]
}) => Promise<readonly ContainerSyncDTO[]>

type ContainerSummaryStatus = GetContainerSummaryResult['status']

const CONTAINER_SUMMARY_STATUSES: readonly ContainerSummaryStatus[] = [
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
]

function isContainerStatus(value: string): value is ContainerSummaryStatus {
  return CONTAINER_SUMMARY_STATUSES.some((item) => item === value)
}

function createProcessWithContainers(destination: string) {
  const process = createProcessEntity({
    id: toProcessId('process-1'),
    reference: toProcessReference('REF-1'),
    origin: 'Shanghai',
    destination,
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

  return { process, processWithContainers }
}

function createSummary(
  containerId: string,
  containerNumber: string,
  operational: TrackingOperationalSummary,
): GetContainerSummaryResult {
  const status: ContainerSummaryStatus = isContainerStatus(operational.status)
    ? operational.status
    : 'UNKNOWN'

  return {
    containerId,
    containerNumber,
    observations: [
      {
        id: `obs-${containerId}`,
        fingerprint: `fp-${containerId}`,
        container_id: containerId,
        container_number: containerNumber,
        type: 'ARRIVAL',
        event_time: operational.eta?.eventTimeIso ?? null,
        event_time_type: operational.eta?.eventTimeType ?? 'EXPECTED',
        location_code: operational.eta?.locationCode ?? null,
        location_display: operational.eta?.locationDisplay ?? null,
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
    status,
    transshipment: {
      hasTransshipment: operational.transshipment.hasTransshipment,
      transshipmentCount: operational.transshipment.count,
      ports: operational.transshipment.ports.map((port) => port.code),
    },
    alerts: [],
    operational,
  }
}

function createControllers(destination: string, getContainerSummary: GetContainerSummaryMock) {
  const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async (command) =>
    command.containerNumbers.map((containerNumber) => ({
      containerNumber,
      carrier: 'msc',
      lastSuccessAt: '2026-02-25T12:00:00.000Z',
      lastAttemptAt: '2026-02-25T12:00:00.000Z',
      isSyncing: false,
      lastErrorCode: null,
      lastErrorAt: null,
    })),
  )

  return createControllersWithSyncMock(destination, getContainerSummary, getContainersSyncMetadata)
}

function createControllersWithSyncMock(
  destination: string,
  getContainerSummary: GetContainerSummaryMock,
  getContainersSyncMetadata: GetContainersSyncMetadataMock,
) {
  const { process, processWithContainers } = createProcessWithContainers(destination)

  return createProcessControllers({
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
      getContainerSummary,
      getContainersSyncMetadata,
    },
  })
}

describe('process controllers', () => {
  it('returns process detail with container operational and process coverage', async () => {
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

    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        if (containerId === 'container-2') {
          return createSummary(containerId, containerNumber, containerTwoSummary)
        }

        return createSummary(containerId, containerNumber, containerOneSummary)
      },
    )

    const controllers = createControllers(
      '{"display_name":"Santos, BR","unlocode":"BRSSZBT"}',
      getContainerSummaryMock,
    )

    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers).toHaveLength(2)
    expect(body.containers[0]?.operational?.eta?.event_time).toBe('2026-03-10T12:00:00.000Z')
    expect(body.containers[1]?.operational?.data_issue).toBe(true)
    expect(body.process_operational?.eta_max?.event_time).toBe('2026-03-10T12:00:00.000Z')
    expect(body.process_operational?.coverage.total).toBe(2)
    expect(body.process_operational?.coverage.with_eta).toBe(1)
    expect(body.containersSync).toHaveLength(2)
    expect(body.containersSync[0]).toEqual({
      containerNumber: 'MSCU1234567',
      carrier: 'msc',
      lastSuccessAt: '2026-02-25T12:00:00.000Z',
      lastAttemptAt: '2026-02-25T12:00:00.000Z',
      isSyncing: false,
      lastErrorCode: null,
      lastErrorAt: null,
    })
    expect(Object.keys(body.containers[0]?.operational ?? {}).sort()).toEqual([
      'data_issue',
      'eta',
      'status',
      'transshipment',
    ])
    expect(Object.keys(body.process_operational ?? {}).sort()).toEqual(['coverage', 'eta_max'])
    expect(Object.keys(body.process_operational?.coverage ?? {}).sort()).toEqual([
      'total',
      'with_eta',
    ])
    expect(getContainerSummaryMock).toHaveBeenCalledTimes(2)
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      1,
      'container-1',
      'MSCU1234567',
      'BRSSZBT',
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      2,
      'container-2',
      'MSCU7654321',
      'BRSSZBT',
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
  })

  it('falls back to deterministic empty sync metadata when sync metadata lookup fails', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )
    const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async () => {
      throw new Error('sync metadata lookup failed')
    })

    const controllers = createControllersWithSyncMock(
      'Santos',
      getContainerSummaryMock,
      getContainersSyncMetadata,
    )

    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containersSync).toEqual([
      {
        containerNumber: 'MSCU1234567',
        carrier: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      {
        containerNumber: 'MSCU7654321',
        carrier: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ])
  })

  it('does not infer POD code from free-text destination names', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )
    const controllers = createControllers('Santos', getContainerSummaryMock)

    await controllers.getProcessById({ params: { id: 'process-1' } })

    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      1,
      'container-1',
      'MSCU1234567',
      null,
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      2,
      'container-2',
      'MSCU7654321',
      null,
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
  })

  it('accepts alphanumeric direct destination codes with numeric terminal suffix', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )
    const controllers = createControllers('ESBCN07', getContainerSummaryMock)

    await controllers.getProcessById({ params: { id: 'process-1' } })

    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      1,
      'container-1',
      'MSCU1234567',
      'ESBCN07',
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      2,
      'container-2',
      'MSCU7654321',
      'ESBCN07',
      expect.any(Date),
      { includeAcknowledgedAlerts: true },
    )
  })
})
