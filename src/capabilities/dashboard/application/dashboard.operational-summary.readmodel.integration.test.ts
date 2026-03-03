import { describe, expect, it, vi } from 'vitest'
import type { DashboardOperationalSummaryReadModelDeps } from '~/capabilities/dashboard/application/dashboard.operational-summary.readmodel'
import { createDashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'

type ProcessesProjection = Awaited<
  ReturnType<
    DashboardOperationalSummaryReadModelDeps['processUseCases']['listProcessesWithContainers']
  >
>['processes']

function makeTrackingOperationalSummary(
  status: string,
  etaEventTimeIso: string | null = null,
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
  args: Pick<TrackingActiveAlertReadModel, 'alert_id' | 'process_id' | 'container_id'> & {
    readonly severity: TrackingActiveAlertReadModel['severity']
    readonly type: TrackingActiveAlertReadModel['type']
    readonly category: TrackingActiveAlertReadModel['category']
  },
): TrackingActiveAlertReadModel {
  return {
    alert_id: args.alert_id,
    process_id: args.process_id,
    container_id: args.container_id,
    category: args.category,
    severity: args.severity,
    type: args.type,
    generated_at: '2026-03-03T00:00:00.000Z',
    fingerprint: null,
    is_active: true,
    retroactive: false,
  }
}

describe('dashboard operational summary read model integration', () => {
  it('aggregates global active-alert totals by severity and category from deterministic fixtures', async () => {
    const fixedNow = new Date('2026-03-03T00:00:00.000Z')

    const processes: ProcessesProjection = [
      {
        process: {
          id: 'process-1',
          reference: 'REF-001',
          origin: 'Santos',
          destination: 'Hamburg',
        },
        containers: [{ id: 'container-1', containerNumber: 'MSCU1111111' }],
      },
      {
        process: {
          id: 'process-2',
          reference: 'REF-002',
          origin: 'Shanghai',
          destination: 'Rotterdam',
        },
        containers: [{ id: 'container-2', containerNumber: 'MSCU2222222' }],
      },
    ]

    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
    const getContainersSummary = vi.fn(
      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
        new Map([
          ['container-1', makeTrackingOperationalSummary('IN_TRANSIT')],
          ['container-2', makeTrackingOperationalSummary('LOADED')],
        ]),
    )

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
      processUseCases: { listProcessesWithContainers },
      trackingUseCases: { getContainersSummary, listActiveAlertReadModel },
      nowFactory: () => fixedNow,
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

  it('orders process rows by dominant severity and keeps processes without alerts visible', async () => {
    const fixedNow = new Date('2026-03-03T00:00:00.000Z')

    const processes: ProcessesProjection = [
      {
        process: {
          id: 'process-none',
          reference: 'REF-NONE',
          origin: 'Santos',
          destination: 'Valencia',
        },
        containers: [{ id: 'container-none', containerNumber: 'MSCU1000001' }],
      },
      {
        process: {
          id: 'process-warning',
          reference: 'REF-WARN',
          origin: 'Shanghai',
          destination: 'Rotterdam',
        },
        containers: [{ id: 'container-warning', containerNumber: 'MSCU1000002' }],
      },
      {
        process: {
          id: 'process-info',
          reference: 'REF-INFO',
          origin: 'Busan',
          destination: 'Hamburg',
        },
        containers: [{ id: 'container-info', containerNumber: 'MSCU1000003' }],
      },
      {
        process: {
          id: 'process-danger',
          reference: 'REF-DANGER',
          origin: 'Ningbo',
          destination: 'Antwerp',
        },
        containers: [{ id: 'container-danger', containerNumber: 'MSCU1000004' }],
      },
    ]

    const listProcessesWithContainers = vi.fn(async () => ({ processes }))
    const getContainersSummary = vi.fn(
      async (): Promise<ReadonlyMap<string, TrackingOperationalSummary>> =>
        new Map([
          ['container-none', makeTrackingOperationalSummary('LOADED', null)],
          [
            'container-warning',
            makeTrackingOperationalSummary('IN_TRANSIT', '2026-03-12T10:00:00.000Z'),
          ],
          [
            'container-info',
            makeTrackingOperationalSummary('IN_PROGRESS', '2026-03-14T10:00:00.000Z'),
          ],
          [
            'container-danger',
            makeTrackingOperationalSummary('ARRIVED_AT_POD', '2026-03-10T10:00:00.000Z'),
          ],
        ]),
    )

    const alerts: readonly TrackingActiveAlertReadModel[] = [
      makeAlert({
        alert_id: 'alert-warning',
        process_id: 'process-warning',
        container_id: 'container-warning',
        category: 'monitoring',
        severity: 'warning',
        type: 'NO_MOVEMENT',
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
      processUseCases: { listProcessesWithContainers },
      trackingUseCases: { getContainersSummary, listActiveAlertReadModel },
      nowFactory: () => fixedNow,
    })

    const result = await useCases.getOperationalSummaryReadModel()

    expect(
      result.processes.map((process) => ({
        processId: process.processId,
        reference: process.reference,
        origin: process.origin,
        destination: process.destination,
        status: process.status,
        eta: process.eta,
        dominantSeverity: process.dominantSeverity,
        activeAlertsCount: process.activeAlertsCount,
      })),
    ).toEqual([
      {
        processId: 'process-danger',
        reference: 'REF-DANGER',
        origin: 'Ningbo',
        destination: 'Antwerp',
        status: 'ARRIVED_AT_POD',
        eta: '2026-03-10T10:00:00.000Z',
        dominantSeverity: 'danger',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-warning',
        reference: 'REF-WARN',
        origin: 'Shanghai',
        destination: 'Rotterdam',
        status: 'IN_TRANSIT',
        eta: '2026-03-12T10:00:00.000Z',
        dominantSeverity: 'warning',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-info',
        reference: 'REF-INFO',
        origin: 'Busan',
        destination: 'Hamburg',
        status: 'IN_PROGRESS',
        eta: '2026-03-14T10:00:00.000Z',
        dominantSeverity: 'info',
        activeAlertsCount: 1,
      },
      {
        processId: 'process-none',
        reference: 'REF-NONE',
        origin: 'Santos',
        destination: 'Valencia',
        status: 'LOADED',
        eta: null,
        dominantSeverity: 'none',
        activeAlertsCount: 0,
      },
    ])
  })
})
