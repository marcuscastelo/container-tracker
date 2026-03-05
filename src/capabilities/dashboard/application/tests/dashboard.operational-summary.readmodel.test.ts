import { describe, expect, it, vi } from 'vitest'
import {
  createDashboardOperationalSummaryReadModelUseCase,
  type DashboardOperationalSummaryReadModelDeps,
} from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithContainers']
  >
>['processes']

function makeTrackingOperationalSummary(
  status: string,
  etaEventTimeIso: string | null,
): TrackingOperationalSummary {
  return {
    status,
    eta:
      etaEventTimeIso === null
        ? null
        : {
            eventTimeIso: etaEventTimeIso,
            eventTimeType: 'EXPECTED',
            state: 'ACTIVE_EXPECTED',
            type: 'ARRIVAL',
            locationCode: null,
            locationDisplay: null,
          },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    dataIssue: false,
  }
}

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
    type: 'NO_MOVEMENT',
    generated_at: '2026-03-03T00:00:00.000Z',
    fingerprint: null,
    is_active: true,
    retroactive: false,
  }
}

describe('createDashboardOperationalSummaryReadModelUseCase', () => {
  it('composes process status/eta/alerts and keeps processes without alerts visible', async () => {
    const fixedNow = new Date('2026-03-03T00:00:00.000Z')
    const processes: ProcessesProjection = [
      {
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
      {
        process: {
          id: 'process-2',
          reference: 'REF-002',
          origin: 'Shanghai',
          destination: 'Hamburg',
        },
        containers: [{ id: 'container-3', containerNumber: 'MSCU3333333' }],
      },
    ]

    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
    const getContainersSummary = vi.fn(
      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
        new Map([
          [
            'container-1',
            makeTrackingOperationalSummary('IN_PROGRESS', '2026-03-12T10:00:00.000Z'),
          ],
          ['container-2', makeTrackingOperationalSummary('IN_TRANSIT', '2026-03-10T10:00:00.000Z')],
          ['container-3', makeTrackingOperationalSummary('LOADED', null)],
        ]),
    )

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert('alert-1', 'process-1', 'container-1', 'info'),
      makeAlert('alert-2', 'process-1', 'container-1', 'warning'),
      makeAlert('alert-3', 'process-1', 'container-2', 'danger'),
    ]
    const listActiveAlertReadModel = vi.fn(async () => ({ alerts }))

    const useCase = createDashboardOperationalSummaryReadModelUseCase({
      processUseCases: { listProcessesWithContainers },
      trackingUseCases: { getContainersSummary, listActiveAlertReadModel },
      nowFactory: () => fixedNow,
    })

    const result = await useCase()

    expect(getContainersSummary).toHaveBeenCalledWith(
      [
        { containerId: 'container-1', containerNumber: 'MSCU1111111' },
        { containerId: 'container-2', containerNumber: 'MSCU2222222' },
        { containerId: 'container-3', containerNumber: 'MSCU3333333' },
      ],
      fixedNow,
    )

    expect(result.processes).toEqual([
      {
        processId: 'process-1',
        reference: 'REF-001',
        origin: 'Santos',
        destination: 'Rotterdam',
        status: 'IN_PROGRESS',
        eta: '2026-03-10T10:00:00.000Z',
        dominantSeverity: 'danger',
        activeAlertsCount: 3,
        activeAlerts: alerts,
      },
      {
        processId: 'process-2',
        reference: 'REF-002',
        origin: 'Shanghai',
        destination: 'Hamburg',
        status: 'LOADED',
        eta: null,
        dominantSeverity: 'none',
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
        eta: 0,
        movement: 3,
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
        category: 'movement',
        severity: 'info',
        type: 'monitoring',
        description: 'NO_MOVEMENT',
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
        category: 'movement',
        severity: 'warning',
        type: 'monitoring',
        description: 'NO_MOVEMENT',
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
        category: 'movement',
        severity: 'danger',
        type: 'monitoring',
        description: 'NO_MOVEMENT',
        generated_at: '2026-03-03T00:00:00.000Z',
        retroactive: false,
      },
    ])
  })
})
