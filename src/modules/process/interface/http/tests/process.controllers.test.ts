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
import { Instant } from '~/shared/time/instant'
import { temporalValueFromDto } from '~/shared/time/tests/helpers'

type GetContainerSummaryMock = (
  containerId: string,
  containerNumber: string,
  podLocationCode?: string | null,
  now?: Instant,
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
    createdAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
    updatedAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
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
        event_time: temporalValueFromDto(operational.eta?.eventTime ?? null),
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
      normalizeAutoCarriers: vi.fn(async () => ({
        ok: true as const,
        process_id: 'process-1',
        normalized: false,
        reason: 'no_changes_required' as const,
        target_carrier_code: null,
        before_summary: 'UNKNOWN' as const,
        after_summary: 'UNKNOWN' as const,
        updated_auto_containers: 0,
        skipped_manual_containers: 0,
        already_aligned_auto_containers: 0,
      })),
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
        eventTime: { kind: 'instant', value: '2026-03-10T12:00:00.000Z' },
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
    expect(body.containers[0]?.operational?.eta?.event_time).toEqual({
      kind: 'instant',
      value: '2026-03-10T12:00:00.000Z',
    })
    expect(body.containers[1]?.operational?.data_issue).toBe(true)
    expect(body.process_operational?.eta_max?.event_time).toEqual({
      kind: 'instant',
      value: '2026-03-10T12:00:00.000Z',
    })
    expect(body.process_operational?.coverage.total).toBe(2)
    expect(body.process_operational?.coverage.with_eta).toBe(1)
    expect(body.containersSync).toHaveLength(2)
  })

  it('returns process detail with derived microbadge fields when containers are in dispersed lifecycle phases', async () => {
    const inTransitSummary: TrackingOperationalSummary = {
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
    const dischargedSummary: TrackingOperationalSummary = {
      status: 'DISCHARGED',
      eta: null,
      etaApplicable: false,
      lifecycleBucket: 'post_arrival_pre_delivery',
      transshipment: {
        hasTransshipment: false,
        count: 0,
        ports: [],
      },
      dataIssue: false,
    }

    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        if (containerId === 'container-2') {
          return createSummary(containerId, containerNumber, dischargedSummary)
        }

        return createSummary(containerId, containerNumber, inTransitSummary)
      },
    )

    const controllers = createControllers('Santos', getContainerSummaryMock)
    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.process_operational?.derived_status).toBe('IN_TRANSIT')
    expect(body.process_operational?.highest_container_status).toBe('DISCHARGED')
    expect(body.process_operational?.has_status_dispersion).toBe(true)
    expect(body.process_operational?.status_counts).toMatchObject({
      IN_TRANSIT: 1,
      DISCHARGED: 1,
    })
    expect(body.process_operational?.status_microbadge).toEqual({
      status: 'DISCHARGED',
      count: 1,
    })
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

  it('keeps process derived_status as UNKNOWN when all containers are UNKNOWN / never synced', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )
    const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async (command) =>
      command.containerNumbers.map((containerNumber) => ({
        containerNumber,
        carrier: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      })),
    )

    const controllers = createControllers(
      'Santos',
      getContainerSummaryMock,
      getContainersSyncMetadata,
    )

    const response = await controllers.getProcessById({ params: { id: 'process-1' } })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers.every((container) => container.status === 'UNKNOWN')).toBe(true)
    expect(body.containersSync.every((sync) => sync.lastSuccessAt === null)).toBe(true)
    expect(body.process_operational?.derived_status).toBe('UNKNOWN')
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
      expect.anything(),
      { includeAcknowledgedAlerts: true },
    )
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      2,
      'container-2',
      'MSCU7654321',
      null,
      expect.anything(),
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
      expect.anything(),
      { includeAcknowledgedAlerts: true },
    )
    expect(getContainerSummaryMock).toHaveBeenNthCalledWith(
      2,
      'container-2',
      'MSCU7654321',
      'ESBCN07',
      expect.anything(),
      { includeAcknowledgedAlerts: true },
    )
  })

  it('returns 204 when deleting an existing process and emits PROCESS_DELETED log', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const getContainerSummaryMock = vi.fn<GetContainerSummaryMock>(
      async (containerId: string, containerNumber: string) => {
        return createSummary(containerId, containerNumber, summary)
      },
    )

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const controllers = createControllers('Santos', getContainerSummaryMock)
      const response = await controllers.deleteProcessById({ params: { id: 'process-1' } })

      expect(response.status).toBe(204)
      expect(await response.text()).toBe('')
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROCESS_DELETED process_id=process-1'),
      )
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reference=REF-1'))
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('container_count=2'))
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('timestamp='))
    } finally {
      consoleInfoSpy.mockRestore()
    }
  })

  it('returns 404 and does not call delete use case when process does not exist', async () => {
    const deleteProcessSpy = vi.fn(async () => ({ deleted: true as const }))
    const { process, processWithContainers } = createProcessWithContainers('Santos')

    const controllers = createProcessControllers({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
        createProcess: vi.fn(async () => ({
          process,
          containers: [],
          warnings: [],
        })),
        findProcessByIdWithContainers: vi.fn(async () => ({ process: null })),
        updateProcess: vi.fn(async () => ({ process: processWithContainers })),
        findProcessById: vi.fn(async () => ({ process })),
        deleteProcess: deleteProcessSpy,
        normalizeAutoCarriers: vi.fn(async () => null),
      },
      trackingUseCases: {
        getContainerSummary: vi.fn<GetContainerSummaryMock>(
          async (containerId: string, containerNumber: string) => {
            return createSummary(
              containerId,
              containerNumber,
              createTrackingOperationalSummaryFallback(false),
            )
          },
        ),
        getContainersSyncMetadata: vi.fn<GetContainersSyncMetadataMock>(async () => []),
      },
    })

    const response = await controllers.deleteProcessById({ params: { id: 'missing-process' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Process not found' })
    expect(deleteProcessSpy).not.toHaveBeenCalled()
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

  it('normalizes only AUTO containers and preserves MANUAL assignments', async () => {
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
      createdAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
      updatedAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
    })
    const normalizeAutoCarriers = vi.fn(async () => ({
      ok: true as const,
      process_id: 'process-1',
      normalized: true,
      reason: 'normalized' as const,
      target_carrier_code: 'msc',
      before_summary: 'MIXED' as const,
      after_summary: 'MIXED' as const,
      updated_auto_containers: 1,
      skipped_manual_containers: 1,
      already_aligned_auto_containers: 1,
    }))

    const controllers = createProcessControllers({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
        createProcess: vi.fn(async () => ({ process, containers: [], warnings: [] })),
        findProcessByIdWithContainers: vi.fn(async () => ({ process: null })),
        updateProcess: vi.fn(async () => ({ process: null })),
        findProcessById: vi.fn(async () => ({ process })),
        deleteProcess: vi.fn(async () => ({ deleted: true as const })),
        normalizeAutoCarriers,
      },
      trackingUseCases: {
        getContainerSummary: vi.fn<GetContainerSummaryMock>(
          async (containerId: string, containerNumber: string) => {
            return createSummary(
              containerId,
              containerNumber,
              createTrackingOperationalSummaryFallback(false),
            )
          },
        ),
        getContainersSyncMetadata: vi.fn<GetContainersSyncMetadataMock>(async () => []),
      },
    })

    const response = await controllers.normalizeAutoCarriersByProcessId({
      params: { id: 'process-1' },
    })
    const body = (await response.json()) as {
      readonly ok: boolean
      readonly normalized: boolean
      readonly target_carrier_code: string
      readonly updated_auto_containers: number
      readonly skipped_manual_containers: number
      readonly after_summary: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.normalized).toBe(true)
    expect(body.target_carrier_code).toBe('msc')
    expect(body.updated_auto_containers).toBe(1)
    expect(body.skipped_manual_containers).toBe(1)
    expect(body.after_summary).toBe('MIXED')
    expect(normalizeAutoCarriers).toHaveBeenCalledWith({ processId: 'process-1' })
  })

  it('returns no-op when normalize target carrier cannot be resolved deterministically', async () => {
    const process = createProcessEntity({
      id: toProcessId('process-1'),
      reference: toProcessReference('REF-1'),
      origin: 'Shanghai',
      destination: 'Santos',
      carrierMode: 'AUTO',
      defaultCarrierCode: null,
      carrier: null,
      billOfLading: null,
      bookingNumber: null,
      importerName: null,
      exporterName: null,
      referenceImporter: null,
      product: null,
      redestinationNumber: null,
      source: toProcessSource('manual'),
      createdAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
      updatedAt: Instant.fromIso('2026-02-01T10:00:00.000Z'),
    })

    const updateCarrier = vi.fn(async () => undefined)
    const normalizeAutoCarriers = vi.fn(async () => ({
      ok: true as const,
      process_id: 'process-1',
      normalized: false,
      reason: 'target_carrier_not_resolved' as const,
      target_carrier_code: null,
      before_summary: 'MIXED' as const,
      after_summary: 'MIXED' as const,
      updated_auto_containers: 0,
      skipped_manual_containers: 0,
      already_aligned_auto_containers: 2,
    }))

    const controllers = createProcessControllers({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
        createProcess: vi.fn(async () => ({ process, containers: [], warnings: [] })),
        findProcessByIdWithContainers: vi.fn(async () => ({ process: null })),
        updateProcess: vi.fn(async () => ({ process: null })),
        findProcessById: vi.fn(async () => ({ process })),
        deleteProcess: vi.fn(async () => ({ deleted: true as const })),
        normalizeAutoCarriers,
      },
      trackingUseCases: {
        getContainerSummary: vi.fn<GetContainerSummaryMock>(
          async (containerId: string, containerNumber: string) => {
            return createSummary(
              containerId,
              containerNumber,
              createTrackingOperationalSummaryFallback(false),
            )
          },
        ),
        getContainersSyncMetadata: vi.fn<GetContainersSyncMetadataMock>(async () => []),
      },
    })

    const response = await controllers.normalizeAutoCarriersByProcessId({
      params: { id: 'process-1' },
    })
    const body = (await response.json()) as {
      readonly ok: boolean
      readonly normalized: boolean
      readonly reason: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.normalized).toBe(false)
    expect(body.reason).toBe('target_carrier_not_resolved')
    expect(updateCarrier).not.toHaveBeenCalled()
    expect(normalizeAutoCarriers).toHaveBeenCalledWith({ processId: 'process-1' })
  })
})
