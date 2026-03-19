import { describe, expect, it, vi } from 'vitest'
import type { DashboardOperationalSummaryReadModelDeps } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import { createDashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type { TemporalValueDto } from '~/shared/time/dto'
import { resolveTemporalDto } from '~/shared/time/tests/helpers'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

type ProcessWithOperationalSummaryProjection = ProcessesProjection[number]

type ProcessFixture = {
  readonly id: string
  readonly reference: string
  readonly origin: string
  readonly destination: string
  readonly containers: readonly {
    readonly id: string
    readonly containerNumber: string
  }[]
  readonly status: ProcessWithOperationalSummaryProjection['summary']['process_status']
  readonly eta: string | TemporalValueDto | null
}

function makeProcessWithSummary(args: ProcessFixture): ProcessWithOperationalSummaryProjection {
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
    },
  }
}

function makeAlert(
  args: Pick<TrackingActiveAlertReadModel, 'alert_id' | 'process_id' | 'container_id'> & {
    readonly severity: TrackingActiveAlertReadModel['severity']
    readonly type: TrackingActiveAlertReadModel['type']
    readonly category: TrackingActiveAlertReadModel['category']
    readonly generated_at?: TrackingActiveAlertReadModel['generated_at']
    readonly retroactive?: TrackingActiveAlertReadModel['retroactive']
    readonly is_active?: TrackingActiveAlertReadModel['is_active']
  },
): TrackingActiveAlertReadModel {
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
        message_params: { location: 'SANTOS' },
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
    alert_id: args.alert_id,
    process_id: args.process_id,
    container_id: args.container_id,
    category: args.category,
    severity: args.severity,
    type: args.type,
    message_key: message.message_key,
    message_params: message.message_params,
    generated_at: args.generated_at ?? '2026-03-03T00:00:00.000Z',
    fingerprint: null,
    is_active: args.is_active ?? true,
    retroactive: args.retroactive ?? false,
  }
}

describe('dashboard operational summary read model integration', () => {
  it('aggregates global active-alert totals by severity and category from deterministic fixtures', async () => {
    const processes: ProcessesProjection = [
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
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alert_id: 'alert-1',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'fact',
        severity: 'danger',
        type: 'CUSTOMS_HOLD',
      }),
      makeAlert({
        alert_id: 'alert-2',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'monitoring',
        severity: 'warning',
        type: 'NO_MOVEMENT',
      }),
      makeAlert({
        alert_id: 'alert-3',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'monitoring',
        severity: 'info',
        type: 'ETA_MISSING',
      }),
      makeAlert({
        alert_id: 'alert-4',
        process_id: 'process-2',
        container_id: 'container-2',
        category: 'fact',
        severity: 'warning',
        type: 'PORT_CHANGE',
      }),
      makeAlert({
        alert_id: 'alert-5',
        process_id: 'process-2',
        container_id: 'container-2',
        category: 'fact',
        severity: 'info',
        type: 'DATA_INCONSISTENT',
      }),
      makeAlert({
        alert_id: 'alert-6',
        process_id: 'process-2',
        container_id: 'container-2',
        category: 'fact',
        severity: 'danger',
        type: 'TRANSSHIPMENT',
      }),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCases = createDashboardUseCases({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: {
        listActiveAlertReadModel,
        getContainersSummary: vi.fn(async () => new Map()),
      },
    })

    const result = await useCases.getOperationalSummaryReadModel()

    expect(result.globalAlerts).toEqual({
      totalActiveAlerts: 6,
      bySeverity: {
        danger: 2,
        warning: 2,
        info: 2,
        success: 0,
      },
      byCategory: {
        eta: 1,
        movement: 2,
        customs: 1,
        status: 1,
        data: 1,
      },
    })
  })

  it('exposes global indicator keys and computes totals from active alerts only', async () => {
    const processes: ProcessesProjection = [
      makeProcessWithSummary({
        id: 'process-1',
        reference: 'REF-001',
        origin: 'Santos',
        destination: 'Hamburg',
        containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
        status: 'IN_TRANSIT',
        eta: '2026-03-11T10:00:00.000Z',
      }),
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alert_id: 'alert-active',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'monitoring',
        severity: 'warning',
        type: 'ETA_PASSED',
        is_active: true,
      }),
      makeAlert({
        alert_id: 'alert-inactive',
        process_id: 'process-1',
        container_id: 'container-1',
        category: 'fact',
        severity: 'danger',
        type: 'CUSTOMS_HOLD',
        is_active: false,
      }),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCases = createDashboardUseCases({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: {
        listActiveAlertReadModel,
        getContainersSummary: vi.fn(async () => new Map()),
      },
    })
    const result = await useCases.getOperationalSummaryReadModel()

    expect(Object.keys(result.globalAlerts)).toEqual([
      'totalActiveAlerts',
      'bySeverity',
      'byCategory',
    ])
    expect(Object.keys(result.globalAlerts.bySeverity)).toEqual([
      'danger',
      'warning',
      'info',
      'success',
    ])
    expect(Object.keys(result.globalAlerts.byCategory)).toEqual([
      'eta',
      'movement',
      'customs',
      'status',
      'data',
    ])

    expect(result.globalAlerts).toEqual({
      totalActiveAlerts: 1,
      bySeverity: {
        danger: 0,
        warning: 1,
        info: 0,
        success: 0,
      },
      byCategory: {
        eta: 1,
        movement: 0,
        customs: 0,
        status: 0,
        data: 0,
      },
    })
  })

  it('builds consolidated active-alert panel with mixed types and generated_at descending order', async () => {
    const processes: ProcessesProjection = [
      makeProcessWithSummary({
        id: 'process-fact',
        reference: 'REF-FACT',
        origin: 'Santos',
        destination: 'Antwerp',
        containers: [{ id: 'container-fact', containerNumber: 'MSCU2000001' }],
        status: 'IN_TRANSIT',
        eta: '2026-03-10T10:00:00.000Z',
      }),
      makeProcessWithSummary({
        id: 'process-monitoring',
        reference: 'REF-MON',
        origin: 'Busan',
        destination: 'Hamburg',
        containers: [{ id: 'container-monitoring', containerNumber: 'MSCU2000002' }],
        status: 'BOOKED',
        eta: '2026-03-09T10:00:00.000Z',
      }),
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alert_id: 'alert-monitoring-eta-passed',
        process_id: 'process-monitoring',
        container_id: 'container-monitoring',
        category: 'monitoring',
        severity: 'warning',
        type: 'ETA_PASSED',
        generated_at: '2026-03-03T10:00:00.000Z',
      }),
      makeAlert({
        alert_id: 'alert-fact-data-inconsistent',
        process_id: 'process-fact',
        container_id: 'container-fact',
        category: 'fact',
        severity: 'danger',
        type: 'DATA_INCONSISTENT',
        generated_at: '2026-03-03T12:45:00.000Z',
        retroactive: true,
      }),
      makeAlert({
        alert_id: 'alert-fact-customs-hold',
        process_id: 'process-fact',
        container_id: 'container-fact',
        category: 'fact',
        severity: 'warning',
        type: 'CUSTOMS_HOLD',
        generated_at: '2026-03-01T14:10:00.000Z',
        retroactive: true,
      }),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCases = createDashboardUseCases({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: {
        listActiveAlertReadModel,
        getContainersSummary: vi.fn(async () => new Map()),
      },
    })

    const result = await useCases.getOperationalSummaryReadModel()

    expect(result.activeAlertsPanel).toEqual([
      {
        process: {
          processId: 'process-fact',
          reference: 'REF-FACT',
          origin: 'Santos',
          destination: 'Antwerp',
        },
        container: {
          containerId: 'container-fact',
          containerNumber: 'MSCU2000001',
        },
        category: 'data',
        severity: 'danger',
        type: 'fact',
        description: 'DATA_INCONSISTENT',
        generated_at: '2026-03-03T12:45:00.000Z',
        retroactive: true,
      },
      {
        process: {
          processId: 'process-monitoring',
          reference: 'REF-MON',
          origin: 'Busan',
          destination: 'Hamburg',
        },
        container: {
          containerId: 'container-monitoring',
          containerNumber: 'MSCU2000002',
        },
        category: 'eta',
        severity: 'warning',
        type: 'monitoring',
        description: 'ETA_PASSED',
        generated_at: '2026-03-03T10:00:00.000Z',
        retroactive: false,
      },
      {
        process: {
          processId: 'process-fact',
          reference: 'REF-FACT',
          origin: 'Santos',
          destination: 'Antwerp',
        },
        container: {
          containerId: 'container-fact',
          containerNumber: 'MSCU2000001',
        },
        category: 'customs',
        severity: 'warning',
        type: 'fact',
        description: 'CUSTOMS_HOLD',
        generated_at: '2026-03-01T14:10:00.000Z',
        retroactive: true,
      },
    ])

    expect(result.activeAlertsPanel.map((alert) => alert.generated_at)).toEqual([
      '2026-03-03T12:45:00.000Z',
      '2026-03-03T10:00:00.000Z',
      '2026-03-01T14:10:00.000Z',
    ])
  })

  it('orders process rows by dominant severity and keeps processes without alerts visible', async () => {
    const processes: ProcessesProjection = [
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
        id: 'process-warning-z',
        reference: 'REF-WARN-Z',
        origin: 'Shanghai',
        destination: 'Rotterdam',
        containers: [{ id: 'container-warning-z', containerNumber: 'MSCU1000002' }],
        status: 'IN_TRANSIT',
        eta: '2026-03-13T10:00:00.000Z',
      }),
      makeProcessWithSummary({
        id: 'process-info',
        reference: 'REF-INFO',
        origin: 'Busan',
        destination: 'Hamburg',
        containers: [{ id: 'container-info', containerNumber: 'MSCU1000003' }],
        status: 'BOOKED',
        eta: '2026-03-14T10:00:00.000Z',
      }),
      makeProcessWithSummary({
        id: 'process-warning-a',
        reference: 'REF-WARN-A',
        origin: 'Xiamen',
        destination: 'Le Havre',
        containers: [{ id: 'container-warning-a', containerNumber: 'MSCU1000005' }],
        status: 'IN_TRANSIT',
        eta: '2026-03-12T10:00:00.000Z',
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
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alert_id: 'alert-warning-z',
        process_id: 'process-warning-z',
        container_id: 'container-warning-z',
        category: 'monitoring',
        severity: 'warning',
        type: 'NO_MOVEMENT',
      }),
      makeAlert({
        alert_id: 'alert-warning-a',
        process_id: 'process-warning-a',
        container_id: 'container-warning-a',
        category: 'monitoring',
        severity: 'warning',
        type: 'ETA_PASSED',
      }),
      makeAlert({
        alert_id: 'alert-danger',
        process_id: 'process-danger',
        container_id: 'container-danger',
        category: 'fact',
        severity: 'danger',
        type: 'TRANSSHIPMENT',
      }),
      makeAlert({
        alert_id: 'alert-info',
        process_id: 'process-info',
        container_id: 'container-info',
        category: 'monitoring',
        severity: 'info',
        type: 'ETA_MISSING',
      }),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCases = createDashboardUseCases({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: {
        listActiveAlertReadModel,
        getContainersSummary: vi.fn(async () => new Map()),
      },
    })

    const result = await useCases.getOperationalSummaryReadModel()

    expect(
      result.processes.map((process) => ({
        processId: process.processId,
        reference: process.reference,
        origin: process.origin,
        destination: process.destination,
        status: process.status,
        eta: process.eta?.value ?? null,
        dominantSeverity: process.dominantSeverity,
        dominantAlertCreatedAt: process.dominantAlertCreatedAt,
        activeAlertsCount: process.activeAlertsCount,
      })),
    ).toEqual([
      {
        processId: 'process-danger',
        reference: 'REF-DANGER',
        origin: 'Ningbo',
        destination: 'Antwerp',
        status: 'IN_TRANSIT',
        eta: '2026-03-10T10:00:00.000Z',
        dominantSeverity: 'danger',
        dominantAlertCreatedAt: '2026-03-03T00:00:00.000Z',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-warning-a',
        reference: 'REF-WARN-A',
        origin: 'Xiamen',
        destination: 'Le Havre',
        status: 'IN_TRANSIT',
        eta: '2026-03-12T10:00:00.000Z',
        dominantSeverity: 'warning',
        dominantAlertCreatedAt: '2026-03-03T00:00:00.000Z',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-warning-z',
        reference: 'REF-WARN-Z',
        origin: 'Shanghai',
        destination: 'Rotterdam',
        status: 'IN_TRANSIT',
        eta: '2026-03-13T10:00:00.000Z',
        dominantSeverity: 'warning',
        dominantAlertCreatedAt: '2026-03-03T00:00:00.000Z',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-info',
        reference: 'REF-INFO',
        origin: 'Busan',
        destination: 'Hamburg',
        status: 'BOOKED',
        eta: '2026-03-14T10:00:00.000Z',
        dominantSeverity: 'info',
        dominantAlertCreatedAt: '2026-03-03T00:00:00.000Z',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-none',
        reference: 'REF-NONE',
        origin: 'Santos',
        destination: 'Valencia',
        status: 'IN_TRANSIT',
        eta: null,
        dominantSeverity: 'none',
        dominantAlertCreatedAt: null,
        activeAlertsCount: 0,
      },
    ])
  })
})
