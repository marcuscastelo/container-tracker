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
import type { ContainerSyncRecord } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import {
  ProcessDetailResponseSchema,
  ProcessesV2ResponseSchema,
} from '~/shared/api-schemas/processes.schemas'

type GetContainerSummaryMock = (
  containerId: string,
  containerNumber: string,
  podLocationCode?: string | null,
  now?: Date,
  options?: { readonly includeAcknowledgedAlerts?: boolean },
) => Promise<GetContainerSummaryResult>

type GetContainersSyncMetadataMock = (command: {
  readonly containerNumbers: readonly string[]
}) => Promise<readonly ContainerSyncRecord[]>

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
  alerts: GetContainerSummaryResult['alerts'] = [],
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
    alerts,
    operational,
  }
}

function createControllers(
  destination: string,
  getContainerSummary: GetContainerSummaryMock,
  getContainersSyncMetadata: GetContainersSyncMetadataMock = vi.fn<GetContainersSyncMetadataMock>(
    async (command) =>
      command.containerNumbers.map((containerNumber) => ({
        containerNumber,
        carrier: 'msc',
        lastSuccessAt: '2026-02-25T12:00:00.000Z',
        lastAttemptAt: '2026-02-25T12:00:00.000Z',
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      })),
  ),
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
  it('returns enriched alert contract with container number and semantic message fields', async () => {
    const containerOneSummary: TrackingOperationalSummary = {
      status: 'IN_TRANSIT',
      eta: null,
      etaApplicable: true,
      lifecycleBucket: 'pre_arrival',
      transshipment: {
        hasTransshipment: false,
        count: 0,
        ports: [],
      },
      dataIssue: false,
    }

    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        if (containerId === 'container-1') {
          return createSummary(containerId, containerNumber, containerOneSummary, [
            {
              id: 'alert-1',
              container_id: 'container-1',
              category: 'fact',
              type: 'TRANSSHIPMENT',
              severity: 'warning',
              message_key: 'alerts.transshipmentDetected',
              message_params: {
                port: 'MAPTM02',
                fromVessel: 'MAERSK NARMADA',
                toVessel: 'CMA CGM LISA MARIE',
              },
              detected_at: '2026-03-01T10:00:00.000Z',
              triggered_at: '2026-03-01T10:00:00.000Z',
              source_observation_fingerprints: ['fp-1', 'fp-2'],
              alert_fingerprint: 'fp-alert',
              retroactive: false,
              provider: 'maersk',
              acked_at: null,
              acked_by: null,
              acked_source: null,
            },
          ])
        }

        return createSummary(containerId, containerNumber, containerOneSummary)
      },
    )

    const controllers = createControllers('Santos', getContainerSummaryMock)
    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.alerts).toEqual([
      {
        id: 'alert-1',
        container_number: 'MSCU1234567',
        category: 'fact',
        type: 'TRANSSHIPMENT',
        severity: 'warning',
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'MAPTM02',
          fromVessel: 'MAERSK NARMADA',
          toVessel: 'CMA CGM LISA MARIE',
        },
        detected_at: '2026-03-01T10:00:00.000Z',
        triggered_at: '2026-03-01T10:00:00.000Z',
        retroactive: false,
        provider: 'maersk',
        lifecycle_state: 'ACTIVE',
        acked_at: null,
        resolved_at: null,
        resolved_reason: null,
      },
    ])
  })

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
      etaApplicable: true,
      lifecycleBucket: 'pre_arrival',
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

    const controllers = createControllers(
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

  it('returns /api/processes-v2 envelope with generated_at and unchanged process items', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )

    const controllers = createControllers('Santos', getContainerSummaryMock)

    const response = await controllers.listProcessesV2()
    const body = ProcessesV2ResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(typeof body.generated_at).toBe('string')
    expect(Array.isArray(body.processes)).toBe(true)
  })
})
