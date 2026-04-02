import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardNavbarAlertsReadModelUseCase,
  type DashboardNavbarAlertsReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.navbar-alerts.readmodel'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardNavbarAlertsReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

function makeAlert(args: {
  readonly alertId: string
  readonly processId: string
  readonly containerId: string
  readonly severity: TrackingActiveAlertReadModel['severity']
  readonly type: TrackingActiveAlertReadModel['type']
  readonly category: TrackingActiveAlertReadModel['category']
  readonly generatedAt: string
  readonly retroactive?: boolean
  readonly isActive?: boolean
}): TrackingActiveAlertReadModel {
  function toMessageContract(
    type: TrackingActiveAlertReadModel['type'],
  ): Pick<TrackingActiveAlertReadModel, 'message_key' | 'message_params'> {
    if (type === 'TRANSSHIPMENT') {
      return {
        message_key: 'alerts.transshipmentDetected',
        message_params: {
          port: 'SANTOS',
          fromVessel: 'VESSEL A',
          toVessel: 'VESSEL B',
        },
      }
    }
    if (type === 'CUSTOMS_HOLD') {
      return {
        message_key: 'alerts.customsHoldDetected',
        message_params: { location: 'HAMBURG' },
      }
    }
    if (type === 'NO_MOVEMENT') {
      return {
        message_key: 'alerts.noMovementDetected',
        message_params: {
          threshold_days: 10,
          days_without_movement: 11,
          days: 11,
          lastEventDate: '2026-02-28',
        },
      }
    }
    if (type === 'ETA_MISSING') {
      return {
        message_key: 'alerts.etaMissing',
        message_params: {},
      }
    }
    if (type === 'ETA_PASSED') {
      return {
        message_key: 'alerts.etaPassed',
        message_params: {},
      }
    }
    if (type === 'PORT_CHANGE') {
      return {
        message_key: 'alerts.portChange',
        message_params: {},
      }
    }
    return {
      message_key: 'alerts.dataInconsistent',
      message_params: {},
    }
  }

  const message = toMessageContract(args.type)
  return {
    alert_id: args.alertId,
    process_id: args.processId,
    container_id: args.containerId,
    category: args.category,
    severity: args.severity,
    type: args.type,
    message_key: message.message_key,
    message_params: message.message_params,
    generated_at: args.generatedAt,
    fingerprint: null,
    is_active: args.isActive ?? true,
    retroactive: args.retroactive ?? false,
  }
}

describe('createDashboardNavbarAlertsReadModelUseCase', () => {
  it('groups alerts by process and container using backend sorting rules', async () => {
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

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alertId: 'alert-warning-latest',
        processId: 'process-warning',
        containerId: 'container-warn-1',
        category: 'monitoring',
        severity: 'warning',
        type: 'NO_MOVEMENT',
        generatedAt: '2026-03-11T12:00:00.000Z',
      }),
      makeAlert({
        alertId: 'alert-danger-old',
        processId: 'process-danger',
        containerId: 'container-danger-1',
        category: 'fact',
        severity: 'danger',
        type: 'CUSTOMS_HOLD',
        generatedAt: '2026-03-09T12:00:00.000Z',
        retroactive: true,
      }),
      makeAlert({
        alertId: 'alert-danger-new',
        processId: 'process-danger',
        containerId: 'container-danger-1',
        category: 'monitoring',
        severity: 'danger',
        type: 'ETA_PASSED',
        generatedAt: '2026-03-10T12:00:00.000Z',
      }),
      makeAlert({
        alertId: 'alert-info',
        processId: 'process-warning',
        containerId: 'container-warn-2',
        category: 'monitoring',
        severity: 'info',
        type: 'ETA_MISSING',
        generatedAt: '2026-03-08T12:00:00.000Z',
      }),
    ]

    const findContainersOperationalSummaryProjection: DashboardNavbarAlertsReadModelDeps['trackingUseCases']['findContainersOperationalSummaryProjection'] =
      vi.fn(async () => {
        const summaries = new Map<string, TrackingOperationalSummary>([
          [
            'container-danger-1',
            {
              status: 'IN_TRANSIT',
              eta: {
                eventTime: temporalDtoFromCanonical('2026-03-24T00:00:00.000Z'),
                eventTimeType: 'EXPECTED',
                state: 'ACTIVE_EXPECTED',
                type: 'ARRIVAL',
                locationCode: 'NLRTM',
                locationDisplay: 'Rotterdam',
              },
              transshipment: {
                hasTransshipment: false,
                count: 0,
                ports: [],
              },
              dataIssue: false,
            },
          ],
          [
            'container-warn-1',
            {
              status: 'LOADED',
              eta: null,
              transshipment: {
                hasTransshipment: false,
                count: 0,
                ports: [],
              },
              dataIssue: false,
            },
          ],
          [
            'container-warn-2',
            {
              status: 'BOOKED',
              eta: null,
              transshipment: {
                hasTransshipment: false,
                count: 0,
                ports: [],
              },
              dataIssue: false,
            },
          ],
        ])
        return summaries
      })

    const useCase = createDashboardNavbarAlertsReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes })),
      },
      trackingUseCases: {
        listActiveAlertReadModel: vi.fn(async () => ({ alerts })),
        findContainersOperationalSummaryProjection,
      },
    })

    const result = await useCase()

    expect(result.totalActiveAlerts).toBe(4)
    expect(result.processes.map((process) => process.processId)).toEqual([
      'process-danger',
      'process-warning',
    ])
    expect(result.processes[0]?.containers[0]?.alerts.map((alert) => alert.alertId)).toEqual([
      'alert-danger-new',
      'alert-danger-old',
    ])
    expect(result.processes[0]?.containers[0]?.alerts[1]?.retroactive).toBe(true)
    expect(result.processes[1]?.containers.map((container) => container.containerId)).toEqual([
      'container-warn-1',
      'container-warn-2',
    ])
    expect(result.processes[1]?.routeSummary).toBe('Santos → Hamburg')
    expect(findContainersOperationalSummaryProjection).toHaveBeenCalledTimes(1)
  })

  it('returns empty summary and skips container summary when no active alerts exist', async () => {
    const findContainersOperationalSummaryProjection = vi.fn(async () => new Map())
    const useCase = createDashboardNavbarAlertsReadModelUseCase({
      processUseCases: {
        listProcessesWithOperationalSummary: vi.fn(async () => ({ processes: [] })),
      },
      trackingUseCases: {
        listActiveAlertReadModel: vi.fn(async () => ({ alerts: [] })),
        findContainersOperationalSummaryProjection,
      },
    })

    await expect(useCase()).resolves.toEqual({
      totalActiveAlerts: 0,
      processes: [],
    })
    expect(findContainersOperationalSummaryProjection).not.toHaveBeenCalled()
  })
})
