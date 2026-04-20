import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardNavbarAlertsReadModelUseCase,
  type DashboardNavbarAlertsReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import type { OperationalIncidentReadModel } from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardNavbarAlertsReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

function toIncidentFactMessageKey(
  type: OperationalIncidentReadModel['type'],
): 'incidents.fact.customsHoldDetected' | 'incidents.fact.etaMissing' | 'incidents.fact.etaPassed' {
  switch (type) {
    case 'CUSTOMS_HOLD':
      return 'incidents.fact.customsHoldDetected'
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
}): DashboardNavbarAlertsReadModelDeps {
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

describe('createDashboardNavbarAlertsReadModelUseCase', () => {
  it('groups incidents by process using backend sorting rules', async () => {
    const processes: ProcessesProjection = [
      {
        pwc: {
          process: {
            id: 'process-warning',
            reference: 'REF-WARN',
            origin: '  Santos ',
            destination: ' Hamburg  ',
            carrier: 'MSC',
          },
          containers: [
            { id: 'container-warn-1', containerNumber: 'MSCU1111111' },
            { id: 'container-warn-2', containerNumber: 'MSCU1111112' },
          ],
        },
        summary: {},
      },
      {
        pwc: {
          process: {
            id: 'process-danger',
            reference: 'REF-DANGER',
            origin: 'Busan',
            destination: 'Rotterdam',
            carrier: 'MAERSK',
          },
          containers: [{ id: 'container-danger-1', containerNumber: 'MSCU2222222' }],
        },
        summary: {},
      },
    ]

    const incidents = [
      makeIncident({
        incidentKey: 'ETA_PASSED:container-warn-1',
        containerId: 'container-warn-1',
        containerNumber: 'MSCU1111111',
        category: 'eta',
        type: 'ETA_PASSED',
        severity: 'warning',
        triggeredAt: '2026-03-11T12:00:00.000Z',
      }),
      makeIncident({
        incidentKey: 'CUSTOMS_HOLD:container-danger-1',
        containerId: 'container-danger-1',
        containerNumber: 'MSCU2222222',
        category: 'customs',
        type: 'CUSTOMS_HOLD',
        severity: 'danger',
        triggeredAt: '2026-03-10T12:00:00.000Z',
      }),
      makeIncident({
        incidentKey: 'ETA_MISSING:container-warn-2',
        containerId: 'container-warn-2',
        containerNumber: 'MSCU1111112',
        category: 'eta',
        type: 'ETA_MISSING',
        severity: 'info',
        triggeredAt: '2026-03-08T12:00:00.000Z',
      }),
    ] as const

    const useCase = createDashboardNavbarAlertsReadModelUseCase(
      createDeps({ processes, incidents }),
    )

    const result = await useCase()

    expect(result.totalActiveIncidents).toBe(3)
    expect(result.processes.map((process) => process.processId)).toEqual([
      'process-danger',
      'process-warning',
    ])
    expect(result.processes[0]?.incidents.map((incident) => incident.incidentKey)).toEqual([
      'CUSTOMS_HOLD:container-danger-1',
    ])
    expect(result.processes[1]?.incidents.map((incident) => incident.incidentKey)).toEqual([
      'ETA_PASSED:container-warn-1',
      'ETA_MISSING:container-warn-2',
    ])
    expect(result.processes[1]?.routeSummary).toBe('Santos → Hamburg')
  })

  it('returns empty summary when no active incidents exist', async () => {
    const useCase = createDashboardNavbarAlertsReadModelUseCase(
      createDeps({
        processes: [
          {
            pwc: {
              process: {
                id: 'process-1',
                reference: 'REF-001',
                origin: 'Santos',
                destination: 'Hamburg',
                carrier: 'MSC',
              },
              containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
            },
            summary: {},
          },
        ],
        incidents: [],
      }),
    )

    expect(await useCase()).toEqual({
      totalActiveIncidents: 0,
      processes: [],
    })
  })

  it('normalizes blank route endpoints to placeholders for navbar display', async () => {
    const useCase = createDashboardNavbarAlertsReadModelUseCase(
      createDeps({
        processes: [
          {
            pwc: {
              process: {
                id: 'process-blank-route',
                reference: 'REF-BLANK',
                origin: '   ',
                destination: '',
                carrier: 'MSC',
              },
              containers: [{ id: 'container-blank-1', containerNumber: 'MSCU1111111' }],
            },
            summary: {},
          },
        ],
        incidents: [
          makeIncident({
            incidentKey: 'ETA_MISSING:container-blank-1',
            containerId: 'container-blank-1',
            containerNumber: 'MSCU1111111',
            category: 'eta',
            type: 'ETA_MISSING',
            severity: 'warning',
            triggeredAt: '2026-03-12T12:00:00.000Z',
          }),
        ],
      }),
    )

    const result = await useCase()

    expect(result.processes).toHaveLength(1)
    expect(result.processes[0]?.routeSummary).toBe('— → —')
  })
})
