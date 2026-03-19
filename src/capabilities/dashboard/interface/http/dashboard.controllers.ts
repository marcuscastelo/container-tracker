import type { DashboardMonthWindowSize } from '~/capabilities/dashboard/application/dashboard.processes-created-by-month.readmodel'
import type { DashboardUseCases } from '~/capabilities/dashboard/application/dashboard.usecases'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'
import {
  DashboardKpisResponseSchema,
  DashboardOperationalSummaryResponseSchema,
  type DashboardProcessesCreatedByMonthQuery,
  DashboardProcessesCreatedByMonthQuerySchema,
  DashboardProcessesCreatedByMonthResponseSchema,
  type NavbarAlertsSummaryResponse,
  NavbarAlertsSummaryResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'
import { systemClock } from '~/shared/time/clock'

type DashboardControllersDeps = {
  readonly dashboardUseCases: Pick<
    DashboardUseCases,
    | 'getOperationalSummaryReadModel'
    | 'getNavbarAlertsSummaryReadModel'
    | 'getDashboardKpisReadModel'
    | 'getProcessesCreatedByMonthReadModel'
  >
}

function toDashboardGlobalAlertsResponse(
  summary: Awaited<ReturnType<DashboardUseCases['getOperationalSummaryReadModel']>>['globalAlerts'],
) {
  return {
    total_active_alerts: summary.totalActiveAlerts,
    by_severity: {
      danger: summary.bySeverity.danger,
      warning: summary.bySeverity.warning,
      info: summary.bySeverity.info,
      success: summary.bySeverity.success,
    },
    by_category: {
      eta: summary.byCategory.eta,
      movement: summary.byCategory.movement,
      customs: summary.byCategory.customs,
      status: summary.byCategory.status,
      data: summary.byCategory.data,
    },
  }
}

function toDashboardProcessExceptionsResponse(
  processes: Awaited<ReturnType<DashboardUseCases['getOperationalSummaryReadModel']>>['processes'],
) {
  return processes.map((process) => ({
    process_id: process.processId,
    reference: process.reference,
    origin: process.origin,
    destination: process.destination,
    derived_status: process.status,
    eta_current: process.eta,
    dominant_severity: process.dominantSeverity,
    dominant_alert_created_at: process.dominantAlertCreatedAt,
    active_alert_count: process.activeAlertsCount,
  }))
}

function toDashboardMonthWindowSize(
  value: DashboardProcessesCreatedByMonthQuery['window'],
): DashboardMonthWindowSize | undefined {
  if (value === '6') return 6
  if (value === '12') return 12
  if (value === '24') return 24
  return undefined
}

type NavbarAlertResponse =
  NavbarAlertsSummaryResponse['processes'][number]['containers'][number]['alerts'][number]
type NavbarContainerResponse =
  NavbarAlertsSummaryResponse['processes'][number]['containers'][number]
type NavbarProcessResponse = NavbarAlertsSummaryResponse['processes'][number]

type NavbarAlertReadModel = Awaited<
  ReturnType<DashboardUseCases['getNavbarAlertsSummaryReadModel']>
>['processes'][number]['containers'][number]['alerts'][number]

function toNavbarAlertResponse(alert: NavbarAlertReadModel): NavbarAlertResponse {
  const baseAlert = {
    alert_id: alert.alertId,
    severity: alert.severity,
    category: alert.category,
    occurred_at: alert.occurredAt,
    retroactive: alert.retroactive,
  }

  if (alert.messageKey === 'alerts.transshipmentDetected') {
    return {
      ...baseAlert,
      message_key: 'alerts.transshipmentDetected',
      message_params: alert.messageParams,
    }
  }

  if (alert.messageKey === 'alerts.customsHoldDetected') {
    return {
      ...baseAlert,
      message_key: 'alerts.customsHoldDetected',
      message_params: alert.messageParams,
    }
  }

  if (alert.messageKey === 'alerts.noMovementDetected') {
    return {
      ...baseAlert,
      message_key: 'alerts.noMovementDetected',
      message_params: alert.messageParams,
    }
  }

  if (alert.messageKey === 'alerts.etaMissing') {
    return {
      ...baseAlert,
      message_key: 'alerts.etaMissing',
      message_params: {},
    }
  }

  if (alert.messageKey === 'alerts.etaPassed') {
    return {
      ...baseAlert,
      message_key: 'alerts.etaPassed',
      message_params: {},
    }
  }

  if (alert.messageKey === 'alerts.portChange') {
    return {
      ...baseAlert,
      message_key: 'alerts.portChange',
      message_params: {},
    }
  }

  return {
    ...baseAlert,
    message_key: 'alerts.dataInconsistent',
    message_params: {},
  }
}

function toNavbarAlertsSummaryResponse(
  summary: Awaited<ReturnType<DashboardUseCases['getNavbarAlertsSummaryReadModel']>>,
): NavbarAlertsSummaryResponse {
  return {
    generated_at: systemClock.now().toIsoString(),
    total_active_alerts: summary.totalActiveAlerts,
    processes: summary.processes.map(
      (process): NavbarProcessResponse => ({
        process_id: process.processId,
        process_reference: process.processReference,
        carrier: process.carrier,
        route_summary: process.routeSummary,
        active_alerts_count: process.activeAlertsCount,
        dominant_severity: process.dominantSeverity,
        latest_alert_at: process.latestAlertAt,
        containers: process.containers.map(
          (container): NavbarContainerResponse => ({
            container_id: container.containerId,
            container_number: container.containerNumber,
            status: container.status,
            eta: container.eta,
            active_alerts_count: container.activeAlertsCount,
            dominant_severity: container.dominantSeverity,
            latest_alert_at: container.latestAlertAt,
            alerts: container.alerts.map(
              (alert): NavbarAlertResponse => toNavbarAlertResponse(alert),
            ),
          }),
        ),
      }),
    ),
  }
}

export function createDashboardControllers(deps: DashboardControllersDeps) {
  const { dashboardUseCases } = deps

  async function getOperationalSummary(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getOperationalSummaryReadModel()
      const generatedAt = systemClock.now().toIsoString()
      const response = {
        generated_at: generatedAt,
        ...toDashboardGlobalAlertsResponse(result.globalAlerts),
        process_exceptions: toDashboardProcessExceptionsResponse(result.processes),
      }
      return jsonResponse(response, 200, DashboardOperationalSummaryResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/operational-summary error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getNavbarAlertsSummary(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getNavbarAlertsSummaryReadModel()
      const response = toNavbarAlertsSummaryResponse(result)
      return jsonResponse(response, 200, NavbarAlertsSummaryResponseSchema)
    } catch (err) {
      console.error('GET /api/alerts/navbar-summary error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getKpis(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getDashboardKpisReadModel()
      const response = {
        activeProcesses: result.activeProcesses,
        trackedContainers: result.trackedContainers,
        processesWithAlerts: result.processesWithAlerts,
        lastSyncAt: result.lastSyncAt,
      }
      return jsonResponse(response, 200, DashboardKpisResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/kpis error:', err)
      return mapErrorToResponse(err)
    }
  }

  async function getProcessesCreatedByMonth({ request }: { request: Request }): Promise<Response> {
    try {
      const url = new URL(request.url)
      const parsedQuery = DashboardProcessesCreatedByMonthQuerySchema.safeParse({
        window: url.searchParams.get('window') ?? undefined,
      })

      if (!parsedQuery.success) {
        return jsonResponse(
          { error: `Invalid monthly chart query: ${parsedQuery.error.message}` },
          400,
        )
      }

      const result = await dashboardUseCases.getProcessesCreatedByMonthReadModel({
        windowSize: toDashboardMonthWindowSize(parsedQuery.data.window),
      })
      const response = {
        months: result.months.map((item) => ({
          month: item.month,
          label: item.label,
          count: item.count,
        })),
      }
      return jsonResponse(response, 200, DashboardProcessesCreatedByMonthResponseSchema)
    } catch (err) {
      console.error('GET /api/dashboard/charts/processes-created-by-month error:', err)
      return mapErrorToResponse(err)
    }
  }

  return {
    getOperationalSummary,
    getNavbarAlertsSummary,
    getKpis,
    getProcessesCreatedByMonth,
  }
}

export type DashboardControllers = ReturnType<typeof createDashboardControllers>
