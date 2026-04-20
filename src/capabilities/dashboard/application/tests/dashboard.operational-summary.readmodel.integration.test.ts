import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type { OperationalIncidentReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import type { TemporalValueDto } from '~/shared/time/dto'
import { resolveTemporalDto } from '~/shared/time/tests/helpers'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

type ProcessFixture = {
  readonly id: string
  readonly reference: string
  readonly origin: string
  readonly destination: string
  readonly containers: readonly {
    readonly id: string
    readonly containerNumber: string
  }[]
  readonly status: NonNullable<ProcessesProjection[number]['summary']['process_status']>
  readonly eta: string | TemporalValueDto | null
}

function toIncidentFactMessageKey(
  type: OperationalIncidentReadModel['type'],
):
  | 'incidents.fact.customsHoldDetected'
  | 'incidents.fact.transshipmentDetected'
  | 'incidents.fact.portChange'
  | 'incidents.fact.dataInconsistent'
  | 'incidents.fact.etaMissing'
  | 'incidents.fact.etaPassed' {
  switch (type) {
    case 'CUSTOMS_HOLD':
      return 'incidents.fact.customsHoldDetected'
    case 'TRANSSHIPMENT':
      return 'incidents.fact.transshipmentDetected'
    case 'PORT_CHANGE':
      return 'incidents.fact.portChange'
    case 'DATA_INCONSISTENT':
      return 'incidents.fact.dataInconsistent'
    case 'ETA_MISSING':
      return 'incidents.fact.etaMissing'
    default:
      return 'incidents.fact.etaPassed'
  }
}

function toIncidentAction(args: {
  readonly type: OperationalIncidentReadModel['type']
  readonly category: OperationalIncidentReadModel['category']
}): NonNullable<OperationalIncidentReadModel['action']> {
  if (args.type === 'CUSTOMS_HOLD') {
    return {
      actionKey: 'incidents.action.followUpCustoms',
      actionParams: {},
      actionKind: 'FOLLOW_UP_CUSTOMS',
    }
  }

  if (args.category === 'data') {
    return {
      actionKey: 'incidents.action.reviewData',
      actionParams: {},
      actionKind: 'REVIEW_DATA',
    }
  }

  return {
    actionKey: 'incidents.action.checkEta',
    actionParams: {},
    actionKind: 'CHECK_ETA',
  }
}

function makeProcessWithSummary(args: ProcessFixture): ProcessesProjection[number] {
  return {
    pwc: {
      process: {
        id: args.id,
        reference: args.reference,
        origin: args.origin,
        destination: args.destination,
      },
      containers: args.containers,
    },
    summary: {
      process_status: args.status,
      eta: resolveTemporalDto(args.eta, null),
      operational_incidents: {
        summary: {
          active_incidents_count: 0,
          affected_containers_count: 0,
          recognized_incidents_count: 0,
        },
        dominant: null,
      },
    },
  }
}

function makeIncident(args: {
  readonly incidentKey: string
  readonly containerId: string
  readonly containerNumber: string
  readonly category: OperationalIncidentReadModel['category']
  readonly type: OperationalIncidentReadModel['type']
  readonly severity: OperationalIncidentReadModel['severity']
  readonly triggeredAt: string
}): OperationalIncidentReadModel {
  return {
    incidentKey: args.incidentKey,
    bucket: 'active',
    category: args.category,
    type: args.type,
    severity: args.severity,
    fact: {
      messageKey: toIncidentFactMessageKey(args.type),
      messageParams: {},
    },
    action: toIncidentAction({
      type: args.type,
      category: args.category,
    }),
    scope: {
      affectedContainerCount: 1,
      containers: [
        {
          containerId: args.containerId,
          containerNumber: args.containerNumber,
          lifecycleState: 'ACTIVE',
        },
      ],
    },
    detectedAt: args.triggeredAt,
    triggeredAt: args.triggeredAt,
    triggerRefs: [
      {
        alertId: `${args.incidentKey}-alert`,
        containerId: args.containerId,
      },
    ],
    members: [
      {
        containerId: args.containerId,
        containerNumber: args.containerNumber,
        lifecycleState: 'ACTIVE',
        detectedAt: args.triggeredAt,
        records: [
          {
            alertId: `${args.incidentKey}-alert`,
            lifecycleState: 'ACTIVE',
            detectedAt: args.triggeredAt,
            triggeredAt: args.triggeredAt,
            ackedAt: null,
            resolvedAt: null,
            resolvedReason: null,
          },
        ],
      },
    ],
  }
}

function createUseCase(args: {
  readonly processes: ProcessesProjection
  readonly incidents: readonly OperationalIncidentReadModel[]
}) {
  return createDashboardOperationalSummaryReadModelUseCase({
    processUseCases: {
      listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: args.processes })),
    },
    trackingUseCases: {
      findContainersHotReadProjection: vi.fn(async () => ({
        containers: [],
        activeOperationalIncidents: {
          summary: {
            activeIncidentCount: args.incidents.length,
            affectedContainerCount: new Set(
              args.incidents.flatMap((incident) =>
                incident.scope.containers.map((container) => container.containerId),
              ),
            ).size,
            recognizedIncidentCount: 0,
          },
          active: args.incidents,
          recognized: [],
        },
        activeAlerts: [],
      })),
    },
  })
}

describe('dashboard operational summary read model integration', () => {
  it('aggregates global active incident totals by severity and category from deterministic fixtures', async () => {
    const useCase = createUseCase({
      processes: [
        makeProcessWithSummary({
          id: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Hamburg',
          containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
          status: 'IN_TRANSIT',
          eta: '2026-03-12T10:00:00.000Z',
        }),
        makeProcessWithSummary({
          id: 'process-2',
          reference: 'REF-002',
          origin: 'Shanghai',
          destination: 'Rotterdam',
          containers: [{ id: 'container-2', containerNumber: 'MSCU2222222' }],
          status: 'IN_TRANSIT',
          eta: null,
        }),
      ],
      incidents: [
        makeIncident({
          incidentKey: 'CUSTOMS_HOLD:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          category: 'customs',
          type: 'CUSTOMS_HOLD',
          severity: 'danger',
          triggeredAt: '2026-03-03T12:45:00.000Z',
        }),
        makeIncident({
          incidentKey: 'ETA_PASSED:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          category: 'eta',
          type: 'ETA_PASSED',
          severity: 'warning',
          triggeredAt: '2026-03-03T10:00:00.000Z',
        }),
        makeIncident({
          incidentKey: 'ETA_MISSING:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          category: 'eta',
          type: 'ETA_MISSING',
          severity: 'info',
          triggeredAt: '2026-03-03T09:00:00.000Z',
        }),
        makeIncident({
          incidentKey: 'PORT_CHANGE:container-2',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          category: 'movement',
          type: 'PORT_CHANGE',
          severity: 'warning',
          triggeredAt: '2026-03-03T08:00:00.000Z',
        }),
        makeIncident({
          incidentKey: 'DATA_INCONSISTENT:container-2',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          category: 'data',
          type: 'DATA_INCONSISTENT',
          severity: 'info',
          triggeredAt: '2026-03-03T07:00:00.000Z',
        }),
        makeIncident({
          incidentKey: 'TRANSSHIPMENT:container-2',
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
          category: 'movement',
          type: 'TRANSSHIPMENT',
          severity: 'danger',
          triggeredAt: '2026-03-03T06:00:00.000Z',
        }),
      ],
    })

    const result = await useCase()

    expect(result.globalAlerts).toEqual({
      totalActiveIncidents: 6,
      affectedContainersCount: 2,
      recognizedIncidentsCount: 0,
      bySeverity: {
        danger: 2,
        warning: 2,
        info: 2,
      },
      byCategory: {
        eta: 2,
        movement: 2,
        customs: 1,
        data: 1,
      },
    })
  })

  it('exposes the global indicator keys in the new incident contract', async () => {
    const useCase = createUseCase({
      processes: [
        makeProcessWithSummary({
          id: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Hamburg',
          containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
          status: 'IN_TRANSIT',
          eta: '2026-03-11T10:00:00.000Z',
        }),
      ],
      incidents: [
        makeIncident({
          incidentKey: 'ETA_PASSED:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
          category: 'eta',
          type: 'ETA_PASSED',
          severity: 'warning',
          triggeredAt: '2026-03-03T10:00:00.000Z',
        }),
      ],
    })

    const result = await useCase()

    expect(Object.keys(result.globalAlerts)).toEqual([
      'totalActiveIncidents',
      'affectedContainersCount',
      'recognizedIncidentsCount',
      'bySeverity',
      'byCategory',
    ])
    expect(Object.keys(result.globalAlerts.bySeverity)).toEqual(['danger', 'warning', 'info'])
    expect(Object.keys(result.globalAlerts.byCategory)).toEqual([
      'eta',
      'movement',
      'customs',
      'data',
    ])
  })

  it('keeps incident ordering driven by severity then triggeredAt descending', async () => {
    const useCase = createUseCase({
      processes: [
        makeProcessWithSummary({
          id: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Antwerp',
          containers: [{ id: 'container-1', containerNumber: 'MSCU2000001' }],
          status: 'IN_TRANSIT',
          eta: '2026-03-10T10:00:00.000Z',
        }),
      ],
      incidents: [
        makeIncident({
          incidentKey: 'ETA_PASSED:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU2000001',
          category: 'eta',
          type: 'ETA_PASSED',
          severity: 'warning',
          triggeredAt: '2026-03-03T10:00:00.000Z',
        }),
        makeIncident({
          incidentKey: 'DATA_INCONSISTENT:container-1',
          containerId: 'container-1',
          containerNumber: 'MSCU2000001',
          category: 'data',
          type: 'DATA_INCONSISTENT',
          severity: 'danger',
          triggeredAt: '2026-03-03T12:45:00.000Z',
        }),
      ],
    })

    const result = await useCase()

    expect(result.processes[0]).toMatchObject({
      processId: 'process-1',
      dominantSeverity: 'danger',
      activeIncidentCount: 2,
      affectedContainerCount: 1,
      dominantIncident: {
        type: 'DATA_INCONSISTENT',
        triggeredAt: '2026-03-03T12:45:00.000Z',
      },
    })
  })

  it('keeps processes without incidents visible in the dashboard rows', async () => {
    const useCase = createUseCase({
      processes: [
        makeProcessWithSummary({
          id: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
          containers: [{ id: 'container-none', containerNumber: 'MSCU1000001' }],
          status: 'IN_TRANSIT',
          eta: null,
        }),
        makeProcessWithSummary({
          id: 'process-danger',
          reference: 'REF-DANGER',
          origin: 'Ningbo',
          destination: 'Antwerp',
          containers: [{ id: 'container-danger', containerNumber: 'MSCU1000004' }],
          status: 'IN_TRANSIT',
          eta: '2026-03-10T10:00:00.000Z',
        }),
      ],
      incidents: [
        makeIncident({
          incidentKey: 'TRANSSHIPMENT:container-danger',
          containerId: 'container-danger',
          containerNumber: 'MSCU1000004',
          category: 'movement',
          type: 'TRANSSHIPMENT',
          severity: 'danger',
          triggeredAt: '2026-03-03T00:00:00.000Z',
        }),
      ],
    })

    const result = await useCase()

    expect(result.processes).toEqual([
      {
        processId: 'process-none',
        reference: 'REF-NONE',
        origin: 'Santos',
        destination: 'Valencia',
        status: 'IN_TRANSIT',
        eta: null,
        dominantSeverity: 'none',
        activeIncidentCount: 0,
        affectedContainerCount: 0,
        dominantIncident: null,
      },
      {
        processId: 'process-danger',
        reference: 'REF-DANGER',
        origin: 'Ningbo',
        destination: 'Antwerp',
        status: 'IN_TRANSIT',
        eta: resolveTemporalDto('2026-03-10T10:00:00.000Z', null),
        dominantSeverity: 'danger',
        activeIncidentCount: 1,
        affectedContainerCount: 1,
        dominantIncident: {
          type: 'TRANSSHIPMENT',
          severity: 'danger',
          fact: {
            messageKey: 'incidents.fact.transshipmentDetected',
            messageParams: {},
          },
          triggeredAt: '2026-03-03T00:00:00.000Z',
        },
      },
    ])
  })
})
