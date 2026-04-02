import { describe, expect, it, vi } from 'vitest'
import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'
import type { ListProcessesWithOperationalSummaryDeps } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import { createListProcessesWithOperationalSummaryUseCase } from '~/modules/process/application/usecases/list-processes-with-operational-summary.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity } from '~/modules/process/domain/process.entity'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { FindContainersHotReadProjectionResult } from '~/modules/tracking/application/usecases/find-containers-hot-read-projection.usecase'
import { Instant } from '~/shared/time/instant'
import { temporalDtoFromCanonical, temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeProcess(processId: string) {
  return createProcessEntity({
    id: toProcessId(processId),
    reference: toProcessReference(`REF-${processId}`),
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
}

function makeOperationalSummary(
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

function createDeps(args?: { readonly hotReadResult?: FindContainersHotReadProjectionResult }) {
  const process = makeProcess('process-1')
  const containers: readonly ProcessContainerRecord[] = [
    {
      id: 'container-1',
      processId: 'process-1',
      containerNumber: 'MSCU1111111',
      carrierCode: 'MSC',
    },
    {
      id: 'container-2',
      processId: 'process-1',
      containerNumber: 'MSCU2222222',
      carrierCode: 'MSC',
    },
  ]
  const findContainersHotReadProjection = vi.fn(async () => {
    if (args?.hotReadResult !== undefined) return args.hotReadResult

    return {
      containers: [
        {
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          status: 'IN_TRANSIT' as const,
          timeline: [],
          operational: makeOperationalSummary({
            status: 'IN_TRANSIT',
            eta: {
              eventTime: temporalDtoFromCanonical('2026-03-10T12:00:00.000Z'),
              eventTimeType: 'EXPECTED' as const,
              state: 'ACTIVE_EXPECTED' as const,
              type: 'ARRIVAL',
              locationCode: 'BRSSZ',
              locationDisplay: 'Santos',
            },
            etaApplicable: true,
            lifecycleBucket: 'pre_arrival' as const,
            transshipment: {
              hasTransshipment: false,
              count: 0,
              ports: [],
            },
            dataIssue: false,
          }),
          activeAlerts: [
            {
              id: 'alert-1',
              container_id: 'container-1',
              category: 'monitoring' as const,
              type: 'ETA_PASSED' as const,
              severity: 'danger' as const,
              message_key: 'alerts.etaPassed' as const,
              message_params: {},
              detected_at: '2026-03-10T12:00:00.000Z',
              triggered_at: '2026-03-10T12:00:00.000Z',
              source_observation_fingerprints: ['fp-1'],
              alert_fingerprint: null,
              retroactive: false,
              provider: null,
              acked_at: null,
              acked_by: null,
              acked_source: null,
            },
          ],
          hasObservations: true,
          lastEventAt: temporalValueFromCanonical('2026-03-09T12:00:00.000Z'),
        },
        {
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          status: 'DISCHARGED' as const,
          timeline: [],
          operational: makeOperationalSummary({
            status: 'DISCHARGED',
            eta: null,
            etaApplicable: false,
            lifecycleBucket: 'post_arrival_pre_delivery' as const,
            transshipment: {
              hasTransshipment: false,
              count: 0,
              ports: [],
            },
            dataIssue: false,
          }),
          activeAlerts: [],
          hasObservations: true,
          lastEventAt: temporalValueFromCanonical('2026-03-11T12:00:00.000Z'),
        },
      ],
      activeAlerts: [
        {
          id: 'alert-1',
          container_id: 'container-1',
          category: 'monitoring' as const,
          type: 'ETA_PASSED' as const,
          severity: 'danger' as const,
          message_key: 'alerts.etaPassed' as const,
          message_params: {},
          detected_at: '2026-03-10T12:00:00.000Z',
          triggered_at: '2026-03-10T12:00:00.000Z',
          source_observation_fingerprints: ['fp-1'],
          alert_fingerprint: null,
          retroactive: false,
          provider: null,
          acked_at: null,
          acked_by: null,
          acked_source: null,
        },
      ],
      activeAlertIncidents: {
        summary: {
          activeIncidentCount: 0,
          affectedContainerCount: 0,
          recognizedIncidentCount: 0,
        },
        active: [],
        recognized: [],
      },
    } satisfies FindContainersHotReadProjectionResult
  })
  const deps: ListProcessesWithOperationalSummaryDeps = {
    repository: {
      fetchAll: vi.fn(async () => [process]),
      fetchById: vi.fn(async () => null),
      create: vi.fn(async () => process),
      update: vi.fn(async () => process),
      delete: vi.fn(async () => undefined),
    },
    containerUseCases: {
      listByProcessIds: vi.fn(async () => ({
        containersByProcessId: new Map([[process.id, containers]]),
      })),
    },
    trackingUseCases: {
      findContainersHotReadProjection,
      getContainersSyncMetadata: vi.fn(async () => [
        {
          containerNumber: 'MSCU1111111',
          lastSuccessAt: '2026-03-10T12:00:00.000Z',
          lastAttemptAt: '2026-03-10T12:00:00.000Z',
          isSyncing: false,
          lastErrorAt: null,
        },
        {
          containerNumber: 'MSCU2222222',
          lastSuccessAt: null,
          lastAttemptAt: null,
          isSyncing: false,
          lastErrorAt: null,
        },
      ]),
    },
  }

  return { deps, findContainersHotReadProjection }
}

describe('createListProcessesWithOperationalSummaryUseCase', () => {
  it('uses a single batch hot-read projection for all containers', async () => {
    const { deps, findContainersHotReadProjection } = createDeps()
    const useCase = createListProcessesWithOperationalSummaryUseCase(deps)

    const result = await useCase()

    expect(findContainersHotReadProjection).toHaveBeenCalledTimes(1)
    expect(findContainersHotReadProjection).toHaveBeenCalledWith({
      containers: [
        { containerId: 'container-1', containerNumber: 'MSCU1111111' },
        { containerId: 'container-2', containerNumber: 'MSCU2222222' },
      ],
      now: expect.any(Instant),
    })
    expect(result.processes).toHaveLength(1)
    expect(result.processes[0]?.summary.process_status).toBe('IN_TRANSIT')
    expect(result.processes[0]?.summary.alerts_count).toBe(1)
    expect(result.processes[0]?.summary.container_count).toBe(2)
  })

  it('fails explicitly when the hot-read projection omits a requested container', async () => {
    const { deps } = createDeps({
      hotReadResult: {
        containers: [
          {
            containerId: 'container-1',
            containerNumber: 'MSCU1111111',
            status: 'IN_TRANSIT',
            timeline: [],
            operational: makeOperationalSummary({
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
            }),
            activeAlerts: [],
            hasObservations: true,
            lastEventAt: null,
          },
        ],
        activeAlerts: [],
        activeAlertIncidents: {
          summary: {
            activeIncidentCount: 0,
            affectedContainerCount: 0,
            recognizedIncidentCount: 0,
          },
          active: [],
          recognized: [],
        },
      },
    })
    const useCase = createListProcessesWithOperationalSummaryUseCase(deps)

    await expect(useCase()).rejects.toThrow('missing list containers')
  })
})
