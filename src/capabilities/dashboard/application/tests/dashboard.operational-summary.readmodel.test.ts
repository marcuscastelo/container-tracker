import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithOperationalSummary']
  >
>['processes']

function makeAlert(
  alertId: string,
  processId: string,
  containerId: string,
  severity: TrackingActiveAlertReadModel['severity'],
): TrackingActiveAlertReadModel {
  return {
    alert_id: alertId,
    process_id: processId,
    container_id: containerId,
    category: 'monitoring',
    severity,
    type: 'ETA_PASSED',
    message_key: 'alerts.etaPassed',
    message_params: {},
    generated_at: '2026-03-03T00:00:00.000Z',
    fingerprint: null,
    is_active: true,
    retroactive: false,
  }
}

describe('createDashboardOperationalSummaryReadModelUseCase', () => {
  it('composes process status/eta/alerts and keeps processes without alerts visible', async () => {
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
        },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert('alert-1', 'process-1', 'container-1', 'info'),
      makeAlert('alert-2', 'process-1', 'container-1', 'warning'),
      makeAlert('alert-3', 'process-1', 'container-2', 'danger'),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCase = createDashboardOperationalSummaryReadModelUseCase({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: { listActiveAlertReadModel },
    })

    const result = await useCase()

    expect(result.processes).toEqual([
      {
        processId: 'process-1',
        reference: 'REF-001',
        origin: 'Santos',
        destination: 'Rotterdam',
        status: 'BOOKED',
        eta: temporalDtoFromCanonical('2026-03-10T10:00:00.000Z'),
        dominantSeverity: 'danger',
        dominantAlertCreatedAt: '2026-03-03T00:00:00.000Z',
        activeAlertsCount: 3,
        activeAlerts: alerts,
      },
      {
        processId: 'process-2',
        reference: 'REF-002',
        origin: 'Shanghai',
        destination: 'Hamburg',
        status: 'IN_TRANSIT',
        eta: null,
        dominantSeverity: 'none',
        dominantAlertCreatedAt: null,
        activeAlertsCount: 0,
        activeAlerts: [],
      },
    ])

    expect(result.globalAlerts).toEqual({
      totalActiveAlerts: 3,
      bySeverity: {
        danger: 1,
        warning: 1,
        info: 1,
        success: 0,
      },
      byCategory: {
        eta: 3,
        movement: 0,
        customs: 0,
        status: 0,
        data: 0,
      },
    })

    expect(result.activeAlertsPanel).toEqual([
      {
        process: {
          processId: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Rotterdam',
        },
        container: {
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
        },
        category: 'eta',
        severity: 'info',
        type: 'monitoring',
        description: 'ETA_PASSED',
        generated_at: '2026-03-03T00:00:00.000Z',
        retroactive: false,
      },
      {
        process: {
          processId: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Rotterdam',
        },
        container: {
          containerId: 'container-1',
          containerNumber: 'MSCU1111111',
        },
        category: 'eta',
        severity: 'warning',
        type: 'monitoring',
        description: 'ETA_PASSED',
        generated_at: '2026-03-03T00:00:00.000Z',
        retroactive: false,
      },
      {
        process: {
          processId: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Rotterdam',
        },
        container: {
          containerId: 'container-2',
          containerNumber: 'MSCU2222222',
        },
        category: 'eta',
        severity: 'danger',
        type: 'monitoring',
        description: 'ETA_PASSED',
        generated_at: '2026-03-03T00:00:00.000Z',
        retroactive: false,
      },
    ])
  })

  it('selects dominantAlertCreatedAt from dominant severity alert', async () => {
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
        },
      },
    ]

    const listProcessesWithOperationalSummary = vi.fn(async () => ({ processes }))
    const alerts: readonly TrackingActiveAlertReadModel[] = [
      {
        ...makeAlert('alert-warning', 'process-1', 'container-1', 'warning'),
        generated_at: '2026-03-03T10:00:00.000Z',
      },
      {
        ...makeAlert('alert-critical', 'process-1', 'container-1', 'danger'),
        generated_at: '2026-03-03T11:00:00.000Z',
      },
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCase = createDashboardOperationalSummaryReadModelUseCase({
      processUseCases: { listProcessesWithOperationalSummary },
      trackingUseCases: { listActiveAlertReadModel },
    })

    const result = await useCase()

    expect(result.processes[0]).toMatchObject({
      processId: 'process-1',
      dominantSeverity: 'danger',
      dominantAlertCreatedAt: '2026-03-03T11:00:00.000Z',
    })
  })
})
