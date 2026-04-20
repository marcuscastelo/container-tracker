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
import { buildShipmentAlertIncidentsReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import type {
  ContainerHotReadProjection,
  FindContainersHotReadProjectionResult,
} from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import type { ContainerSyncRecord } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import type { TrackingValidationContainerSummary } from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import {
  ProcessDetailResponseSchema,
  ProcessesV2ResponseSchema,
  ProcessRecognizedOperationalIncidentsResponseSchema,
  ProcessSyncSnapshotResponseSchema,
} from '~/shared/api-schemas/processes.schemas'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromDto } from '~/shared/time/tests/helpers'

type FindContainersHotReadProjectionMock = (command: {
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly podLocationCode?: string | null
  }[]
  readonly now: Instant
}) => Promise<FindContainersHotReadProjectionResult>

type GetContainersSyncMetadataMock = (command: {
  readonly containerNumbers: readonly string[]
}) => Promise<readonly ContainerSyncRecord[]>

type ContainerSummaryStatus = ContainerHotReadProjection['status']

const CONTAINER_SUMMARY_STATUSES: readonly ContainerSummaryStatus[] = [
  'UNKNOWN',
  'IN_PROGRESS',
  'BOOKED',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
]

const EMPTY_TRACKING_VALIDATION: TrackingValidationContainerSummary = {
  hasIssues: false,
  findingCount: 0,
  highestSeverity: null,
  activeIssues: [],
  topIssue: null,
}

function isContainerStatus(value: string): value is ContainerSummaryStatus {
  return CONTAINER_SUMMARY_STATUSES.some((item) => item === value)
}

function createProcessDetailRequest(): Request {
  return new Request('http://localhost/api/processes/process-1')
}

function createProcessSyncSnapshotRequest(): Request {
  return new Request('http://localhost/api/processes/process-1/sync-state')
}

function createRecognizedAlertsRequest(): Request {
  return new Request('http://localhost/api/processes/process-1/operational-incidents/recognized')
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

function makeTrackingOperationalSummary(
  overrides: Partial<TrackingOperationalSummary> = {},
): TrackingOperationalSummary {
  const fallback = createTrackingOperationalSummaryFallback(false)

  return {
    ...fallback,
    ...overrides,
    currentContext: overrides.currentContext ?? fallback.currentContext,
    nextLocation: overrides.nextLocation ?? fallback.nextLocation,
    transshipment: overrides.transshipment ?? fallback.transshipment,
  }
}

function createHotReadContainer(
  containerId: string,
  containerNumber: string,
  operational: TrackingOperationalSummary,
  alerts: FindContainersHotReadProjectionResult['activeAlerts'] = [],
): ContainerHotReadProjection {
  const status: ContainerSummaryStatus = isContainerStatus(operational.status)
    ? operational.status
    : 'UNKNOWN'

  return {
    containerId,
    containerNumber,
    timeline: [],
    status,
    operational,
    trackingValidation: EMPTY_TRACKING_VALIDATION,
    trackingContainment: null,
    activeAlerts: alerts,
    hasObservations: operational.dataIssue !== true,
    lastEventAt: temporalValueFromDto(operational.eta?.eventTime ?? null),
  }
}

function createHotReadProjection(
  containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly operational: TrackingOperationalSummary
    readonly alerts?: FindContainersHotReadProjectionResult['activeAlerts']
  }[],
): FindContainersHotReadProjectionResult {
  const hotReadContainers = containers.map((container) =>
    createHotReadContainer(
      container.containerId,
      container.containerNumber,
      container.operational,
      container.alerts ?? [],
    ),
  )
  const activeAlerts = hotReadContainers.flatMap((container) => container.activeAlerts)
  const activeOperationalIncidents = buildShipmentAlertIncidentsReadModel({
    containers: hotReadContainers.map((container) => ({
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      alerts: container.activeAlerts,
    })),
  })

  return {
    containers: hotReadContainers,
    activeAlerts,
    activeOperationalIncidents,
  }
}

function createControllers(
  destination: string,
  findContainersHotReadProjection: FindContainersHotReadProjectionMock,
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
  trackingOverrides?: Partial<
    Pick<TrackingUseCases, 'findContainersRecognizedOperationalIncidentsProjection'>
  >,
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
      findContainersHotReadProjection,
      getContainersSyncMetadata,
      ...(trackingOverrides?.findContainersRecognizedOperationalIncidentsProjection === undefined
        ? {}
        : {
            findContainersRecognizedOperationalIncidentsProjection:
              trackingOverrides.findContainersRecognizedOperationalIncidentsProjection,
          }),
    },
  })
}

describe('process controllers', () => {
  it('returns enriched alert contract with container number and semantic message fields', async () => {
    const containerOneSummary = makeTrackingOperationalSummary({
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
    })

    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: containerOneSummary,
            alerts: [
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
            ],
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: containerOneSummary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(Object.hasOwn(body, 'alerts')).toBe(false)
    expect(body.operational_incidents?.summary).toEqual({
      active_incidents: 1,
      affected_containers: 1,
      recognized_incidents: 0,
    })
    expect(body.operational_incidents?.active[0]?.fact.message_key).toBe(
      'incidents.fact.transshipmentDetected',
    )
    expect(body.operational_incidents?.active[0]?.action?.action_key).toBe(
      'incidents.action.updateRedestination',
    )
    expect(body.operational_incidents?.active[0]?.detected_at).toBe('2026-03-01T10:00:00.000Z')
    expect(body.operational_incidents?.active[0]?.members[0]?.container_number).toBe('MSCU1234567')
    expect(body.operational_incidents?.active[0]?.members[0]?.detected_at).toBe(
      '2026-03-01T10:00:00.000Z',
    )
  })

  it('returns process detail with container operational and process coverage', async () => {
    const containerOneSummary = makeTrackingOperationalSummary({
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
    })
    const containerTwoSummary = createTrackingOperationalSummaryFallback(true)

    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: containerOneSummary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: containerTwoSummary,
          },
        ]),
    )

    const controllers = createControllers(
      '{"display_name":"Santos, BR","unlocode":"BRSSZBT"}',
      findContainersHotReadProjectionMock,
    )

    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers).toHaveLength(2)
    expect(body.containers[0]?.operational?.eta?.event_time).toEqual({
      kind: 'instant',
      value: '2026-03-10T12:00:00.000Z',
    })
    expect(body.containers[0]?.operational?.eta_display).toEqual({
      kind: 'date',
      value: {
        kind: 'instant',
        value: '2026-03-10T12:00:00.000Z',
      },
    })
    expect(body.containers[1]?.operational?.eta_display).toEqual({
      kind: 'unavailable',
    })
    expect(body.containers[1]?.operational?.data_issue).toBe(true)
    expect(body.process_operational?.eta_max?.event_time).toEqual({
      kind: 'instant',
      value: '2026-03-10T12:00:00.000Z',
    })
    expect(body.process_operational?.eta_display).toEqual({
      kind: 'date',
      value: {
        kind: 'instant',
        value: '2026-03-10T12:00:00.000Z',
      },
    })
    expect(body.process_operational?.coverage.total).toBe(2)
    expect(body.process_operational?.coverage.with_eta).toBe(1)
    expect(body.containersSync).toHaveLength(2)
  })

  it('returns delivered eta_display when the process is in final delivery', async () => {
    const deliveredSummary = makeTrackingOperationalSummary({
      status: 'DELIVERED',
      eta: null,
      etaApplicable: false,
      lifecycleBucket: 'final_delivery',
      transshipment: {
        hasTransshipment: false,
        count: 0,
        ports: [],
      },
      dataIssue: false,
    })
    const emptyReturnedSummary = makeTrackingOperationalSummary({
      status: 'EMPTY_RETURNED',
      eta: null,
      etaApplicable: false,
      lifecycleBucket: 'final_delivery',
      transshipment: {
        hasTransshipment: false,
        count: 0,
        ports: [],
      },
      dataIssue: false,
    })

    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: deliveredSummary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: emptyReturnedSummary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers[0]?.operational?.eta_display).toEqual({
      kind: 'delivered',
    })
    expect(body.containers[1]?.operational?.eta_display).toEqual({
      kind: 'delivered',
    })
    expect(body.process_operational?.eta_display).toEqual({
      kind: 'delivered',
    })
    expect(body.process_operational?.final_delivery_complete).toBe(true)
  })

  it('returns arrived eta_display for containers and process when ETA is ACTUAL', async () => {
    const arrivedSummary = makeTrackingOperationalSummary({
      status: 'DISCHARGED',
      eta: {
        eventTime: { kind: 'date', value: '2026-03-28' },
        eventTimeType: 'ACTUAL',
        state: 'ACTUAL',
        type: 'ARRIVAL',
        locationCode: 'BRSSZ',
        locationDisplay: 'Santos',
      },
      etaApplicable: true,
      lifecycleBucket: 'post_arrival_pre_delivery',
      transshipment: {
        hasTransshipment: false,
        count: 0,
        ports: [],
      },
      dataIssue: false,
    })

    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: arrivedSummary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: arrivedSummary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers[0]?.operational?.eta_display).toEqual({
      kind: 'arrived',
      value: {
        kind: 'date',
        value: '2026-03-28',
      },
    })
    expect(body.process_operational?.eta_display).toEqual({
      kind: 'arrived',
      value: {
        kind: 'date',
        value: '2026-03-28',
      },
    })
  })

  it('returns process detail with derived microbadge fields when containers are in dispersed lifecycle phases', async () => {
    const inTransitSummary = makeTrackingOperationalSummary({
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
    })
    const dischargedSummary = makeTrackingOperationalSummary({
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
    })

    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: inTransitSummary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: dischargedSummary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
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

  it('returns a tiny sync snapshot contract for reconciliation', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
    const response = await controllers.getProcessSyncSnapshot({
      params: { id: 'process-1' },
      request: createProcessSyncSnapshotRequest(),
    })
    const body = ProcessSyncSnapshotResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.tracking_freshness_token).toEqual(expect.any(String))
    expect(body.containersSync).toEqual([
      {
        containerNumber: 'MSCU1234567',
        carrier: 'msc',
        lastSuccessAt: '2026-02-25T12:00:00.000Z',
        lastAttemptAt: '2026-02-25T12:00:00.000Z',
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      {
        containerNumber: 'MSCU7654321',
        carrier: 'msc',
        lastSuccessAt: '2026-02-25T12:00:00.000Z',
        lastAttemptAt: '2026-02-25T12:00:00.000Z',
        isSyncing: false,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ])
  })

  it('returns recognized alert incidents through the lazy archive endpoint', async () => {
    const containerId = 'container-1'
    const recognizedAlertIncidents = buildShipmentAlertIncidentsReadModel({
      containers: [
        {
          containerId,
          containerNumber: 'MSCU1234567',
          alerts: [
            {
              id: 'alert-recognized-1',
              container_id: containerId,
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
              source_observation_fingerprints: ['fp-1'],
              alert_fingerprint: 'recognized-fingerprint',
              retroactive: false,
              provider: 'maersk',
              acked_at: '2026-03-01T11:00:00.000Z',
              acked_by: 'operator@container-tracker',
              acked_source: 'dashboard',
              resolved_at: null,
              resolved_reason: null,
            },
          ],
        },
      ],
    })

    const controllers = createControllers(
      'Santos',
      vi.fn<FindContainersHotReadProjectionMock>(async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: createTrackingOperationalSummaryFallback(false),
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: createTrackingOperationalSummaryFallback(false),
          },
        ]),
      ),
      undefined,
      {
        findContainersRecognizedOperationalIncidentsProjection: vi.fn(
          async () => recognizedAlertIncidents,
        ),
      },
    )

    const response = await controllers.getProcessRecognizedOperationalIncidents({
      params: { id: 'process-1' },
      request: createRecognizedAlertsRequest(),
    })
    const body = ProcessRecognizedOperationalIncidentsResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.summary).toEqual({
      active_incidents: 0,
      affected_containers: 0,
      recognized_incidents: 1,
    })
    expect(body.recognized).toHaveLength(1)
    expect(body.recognized[0]?.type).toBe('TRANSSHIPMENT')
    expect(body.recognized[0]?.members[0]?.container_number).toBe('MSCU1234567')
  })

  it('falls back to deterministic empty sync metadata when sync metadata lookup fails', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )
    const getContainersSyncMetadata = vi.fn<GetContainersSyncMetadataMock>(async () => {
      throw new Error('sync metadata lookup failed')
    })

    const controllers = createControllers(
      'Santos',
      findContainersHotReadProjectionMock,
      getContainersSyncMetadata,
    )

    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
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
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
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
      findContainersHotReadProjectionMock,
      getContainersSyncMetadata,
    )

    const response = await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })
    const body = ProcessDetailResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.containers.every((container) => container.status === 'UNKNOWN')).toBe(true)
    expect(body.containersSync.every((sync) => sync.lastSuccessAt === null)).toBe(true)
    expect(body.process_operational?.derived_status).toBe('UNKNOWN')
  })

  it('does not infer POD code from free-text destination names', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )
    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)

    await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })

    expect(findContainersHotReadProjectionMock).toHaveBeenCalledTimes(1)
    expect(findContainersHotReadProjectionMock).toHaveBeenCalledWith({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'MSCU1234567',
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSCU7654321',
        },
      ],
      now: expect.any(Instant),
    })
  })

  it('accepts alphanumeric direct destination codes with numeric terminal suffix', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )
    const controllers = createControllers('ESBCN07', findContainersHotReadProjectionMock)

    await controllers.getProcessById({
      params: { id: 'process-1' },
      request: createProcessDetailRequest(),
    })

    expect(findContainersHotReadProjectionMock).toHaveBeenCalledTimes(1)
    expect(findContainersHotReadProjectionMock).toHaveBeenCalledWith({
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'MSCU1234567',
          podLocationCode: 'ESBCN07',
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSCU7654321',
          podLocationCode: 'ESBCN07',
        },
      ],
      now: expect.any(Instant),
    })
  })

  it('returns 204 when deleting an existing process and emits PROCESS_DELETED log', async () => {
    const summary = createTrackingOperationalSummaryFallback(false)
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      const controllers = createControllers('Santos', findContainersHotReadProjectionMock)
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
      },
      trackingUseCases: {
        findContainersHotReadProjection: vi.fn<FindContainersHotReadProjectionMock>(async () =>
          createHotReadProjection([
            {
              containerId: 'container-1',
              containerNumber: 'MSCU1234567',
              operational: createTrackingOperationalSummaryFallback(false),
            },
            {
              containerId: 'container-2',
              containerNumber: 'MSCU7654321',
              operational: createTrackingOperationalSummaryFallback(false),
            },
          ]),
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
    const findContainersHotReadProjectionMock = vi.fn<FindContainersHotReadProjectionMock>(
      async () =>
        createHotReadProjection([
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1234567',
            operational: summary,
          },
          {
            containerId: 'container-2',
            containerNumber: 'MSCU7654321',
            operational: summary,
          },
        ]),
    )

    const controllers = createControllers('Santos', findContainersHotReadProjectionMock)

    const response = await controllers.listProcessesV2()
    const body = ProcessesV2ResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(typeof body.generated_at).toBe('string')
    expect(Array.isArray(body.processes)).toBe(true)
  })
})
