import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type { OperationalIncidentReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

function toIncidentFactMessageKey(
  type: OperationalIncidentReadModel['type'],
):
  | 'incidents.fact.customsHoldDetected'
  | 'incidents.fact.transshipmentDetected'
  | 'incidents.fact.etaMissing'
  | 'incidents.fact.etaPassed' {
  switch (type) {
    case 'CUSTOMS_HOLD':
      return 'incidents.fact.customsHoldDetected'
    case 'TRANSSHIPMENT':
      return 'incidents.fact.transshipmentDetected'
    case 'ETA_MISSING':
      return 'incidents.fact.etaMissing'
    default:
      return 'incidents.fact.etaPassed'
  }
}

function toIncidentAction(
  type: OperationalIncidentReadModel['type'],
): NonNullable<OperationalIncidentReadModel['action']> {
  if (type === 'CUSTOMS_HOLD') {
    return {
      actionKey: 'incidents.action.followUpCustoms',
      actionParams: {},
      actionKind: 'FOLLOW_UP_CUSTOMS',
    }
  }

  return {
    actionKey: 'incidents.action.checkEta',
    actionParams: {},
    actionKind: 'CHECK_ETA',
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
    action: toIncidentAction(args.type),
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

function createDeps(args: {
  readonly processes: ProcessesProjection
  readonly incidents: readonly OperationalIncidentReadModel[]
}): DashboardOperationalSummaryReadModelDeps {
  return {
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
  }
}

describe('createDashboardOperationalSummaryReadModelUseCase', () => {
  it('composes process status and incident summaries while keeping processes without incidents visible', async () => {
    const processes: ProcessesProjection = [
      {
        pwc: {
          process: {
            id: 'process-1',
            reference: 'REF-001',
            origin: 'Santos',
            destination: 'Rotterdam',
          },
          containers: [
            { id: 'container-1', containerNumber: 'MSCU1111111' },
            { id: 'container-2', containerNumber: 'MSCU2222222' },
          ],
        },
        summary: {
          process_status: 'BOOKED',
          eta: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
          operational_incidents: {
            summary: {
              active_incidents_count: 2,
              affected_containers_count: 2,
              recognized_incidents_count: 0,
            },
            dominant: {
              type: 'CUSTOMS_HOLD',
              severity: 'danger',
              fact: {
                messageKey: 'incidents.fact.customsHoldDetected',
                messageParams: {},
              },
              triggeredAt: '2026-03-03T00:00:00.000Z',
            },
          },
        },
      },
      {
        pwc: {
          process: {
            id: 'process-2',
            reference: 'REF-002',
            origin: 'Shanghai',
            destination: 'Hamburg',
          },
          containers: [{ id: 'container-3', containerNumber: 'MSCU3333333' }],
        },
        summary: {
          process_status: 'IN_TRANSIT',
          eta: null,
          operational_incidents: {
            summary: {
              active_incidents_count: 0,
              affected_containers_count: 0,
              recognized_incidents_count: 0,
            },
            dominant: null,
          },
        },
      },
    ]

    const incidents = [
      makeIncident({
        incidentKey: 'CUSTOMS_HOLD:container-1',
        containerId: 'container-1',
        containerNumber: 'MSCU1111111',
        category: 'customs',
        type: 'CUSTOMS_HOLD',
        severity: 'danger',
        triggeredAt: '2026-03-03T00:00:00.000Z',
      }),
      makeIncident({
        incidentKey: 'ETA_PASSED:container-2',
        containerId: 'container-2',
        containerNumber: 'MSCU2222222',
        category: 'eta',
        type: 'ETA_PASSED',
        severity: 'warning',
        triggeredAt: '2026-03-02T00:00:00.000Z',
      }),
    ] as const

    const result = await createDashboardOperationalSummaryReadModelUseCase(
      createDeps({ processes, incidents }),
    )()

    expect(result.processes).toEqual([
      {
        processId: 'process-1',
        reference: 'REF-001',
        origin: 'Santos',
        destination: 'Rotterdam',
        status: 'BOOKED',
        eta: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
        dominantSeverity: 'danger',
        activeIncidentCount: 2,
        affectedContainerCount: 2,
        dominantIncident: {
          type: 'CUSTOMS_HOLD',
          severity: 'danger',
          fact: {
            messageKey: 'incidents.fact.customsHoldDetected',
            messageParams: {},
          },
          triggeredAt: '2026-03-03T00:00:00.000Z',
        },
      },
      {
        processId: 'process-2',
        reference: 'REF-002',
        origin: 'Shanghai',
        destination: 'Hamburg',
        status: 'IN_TRANSIT',
        eta: null,
        dominantSeverity: 'none',
        activeIncidentCount: 0,
        affectedContainerCount: 0,
        dominantIncident: null,
      },
    ])

    expect(result.globalAlerts).toEqual({
      totalActiveIncidents: 2,
      affectedContainersCount: 2,
      recognizedIncidentsCount: 0,
      bySeverity: {
        danger: 1,
        warning: 1,
        info: 0,
      },
      byCategory: {
        eta: 1,
        movement: 0,
        customs: 1,
        data: 0,
      },
    })
  })

  it('uses dominant incident triggeredAt to expose the dominant incident in the process row', async () => {
    const processes: ProcessesProjection = [
      {
        pwc: {
          process: {
            id: 'process-1',
            reference: 'REF-001',
            origin: 'Santos',
            destination: 'Rotterdam',
          },
          containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
        },
        summary: {
          process_status: 'BOOKED',
          eta: null,
          operational_incidents: {
            summary: {
              active_incidents_count: 2,
              affected_containers_count: 1,
              recognized_incidents_count: 0,
            },
            dominant: {
              type: 'CUSTOMS_HOLD',
              severity: 'danger',
              fact: {
                messageKey: 'incidents.fact.customsHoldDetected',
                messageParams: {},
              },
              triggeredAt: '2026-03-03T11:00:00.000Z',
            },
          },
        },
      },
    ]

    const incidents = [
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
        incidentKey: 'CUSTOMS_HOLD:container-1',
        containerId: 'container-1',
        containerNumber: 'MSCU1111111',
        category: 'customs',
        type: 'CUSTOMS_HOLD',
        severity: 'danger',
        triggeredAt: '2026-03-03T11:00:00.000Z',
      }),
    ] as const

    const result = await createDashboardOperationalSummaryReadModelUseCase(
      createDeps({ processes, incidents }),
    )()

    expect(result.processes[0]).toMatchObject({
      processId: 'process-1',
      dominantSeverity: 'danger',
      dominantIncident: {
        type: 'CUSTOMS_HOLD',
        triggeredAt: '2026-03-03T11:00:00.000Z',
      },
    })
  })
})
