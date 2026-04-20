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
import {
  readAuditedTriggerSource,
  runWithReadRequestAudit,
} from '~/shared/observability/readRequestMetrics'
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
    total_active_incidents: summary.totalActiveIncidents,
    affected_containers_count: summary.affectedContainersCount,
    recognized_incidents_count: summary.recognizedIncidentsCount,
    by_severity: {
      danger: summary.bySeverity.danger,
      warning: summary.bySeverity.warning,
      info: summary.bySeverity.info,
    },
    by_category: {
      eta: summary.byCategory.eta,
      movement: summary.byCategory.movement,
      customs: summary.byCategory.customs,
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
    active_incident_count: process.activeIncidentCount,
    affected_container_count: process.affectedContainerCount,
    dominant_incident:
      process.dominantIncident === null
        ? null
        : {
            type: process.dominantIncident.type,
            severity: process.dominantIncident.severity,
            fact: {
              message_key: process.dominantIncident.fact.messageKey,
              message_params: process.dominantIncident.fact.messageParams,
            },
            triggered_at: process.dominantIncident.triggeredAt,
          },
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

type NavbarIncidentResponse = NavbarAlertsSummaryResponse['processes'][number]['incidents'][number]
type NavbarProcessResponse = NavbarAlertsSummaryResponse['processes'][number]

type NavbarIncidentReadModel = Awaited<
  ReturnType<DashboardUseCases['getNavbarAlertsSummaryReadModel']>
>['processes'][number]['incidents'][number]

function toNavbarIncidentResponse(incident: NavbarIncidentReadModel): NavbarIncidentResponse {
  return {
    incident_key: incident.incidentKey,
    type: incident.type,
    category: incident.category,
    severity: incident.severity,
    fact: {
      message_key: incident.fact.messageKey,
      message_params: incident.fact.messageParams,
    },
    action:
      incident.action === null
        ? null
        : {
            action_key: incident.action.actionKey,
            action_params: incident.action.actionParams,
            action_kind: incident.action.actionKind,
          },
    affected_container_count: incident.affectedContainerCount,
    triggered_at: incident.triggeredAt,
    containers: incident.containers.map((container) => ({
      container_id: container.containerId,
      container_number: container.containerNumber,
      lifecycle_state: container.lifecycleState,
    })),
  }
}

function toNavbarAlertsSummaryResponse(
  summary: Awaited<ReturnType<DashboardUseCases['getNavbarAlertsSummaryReadModel']>>,
): NavbarAlertsSummaryResponse {
  return {
    generated_at: systemClock.now().toIsoString(),
    total_active_incidents: summary.totalActiveIncidents,
    processes: summary.processes.map(
      (process): NavbarProcessResponse => ({
        process_id: process.processId,
        process_reference: process.processReference,
        carrier: process.carrier,
        route_summary: process.routeSummary,
        active_incident_count: process.activeIncidentCount,
        affected_container_count: process.affectedContainerCount,
        dominant_severity: process.dominantSeverity,
        latest_incident_at: process.latestIncidentAt,
        incidents: process.incidents.map(
          (incident): NavbarIncidentResponse => toNavbarIncidentResponse(incident),
        ),
      }),
    ),
  }
}

export function createDashboardControllers(deps: DashboardControllersDeps) {
  const { dashboardUseCases } = deps

  async function getOperationalSummary({
    request,
  }: {
    readonly request: Request
  }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/dashboard/operational-summary',
        projection: 'DashboardOperationalSummaryResponse',
        readStrategy: 'tracking.hot_read_projection.dashboard_operational_summary',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
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
      },
    )
  }

  async function getNavbarOperationalIncidentsSummary({
    request,
  }: {
    readonly request: Request
  }): Promise<Response> {
    return runWithReadRequestAudit(
      {
        endpoint: '/api/operational-incidents/navbar-summary',
        projection: 'NavbarAlertsSummaryResponse',
        readStrategy: 'tracking.operational_summary_projection.navbar_operational_incidents',
        triggeredBy: readAuditedTriggerSource(request),
      },
      async () => {
        try {
          const result = await dashboardUseCases.getNavbarAlertsSummaryReadModel()
          const response = toNavbarAlertsSummaryResponse(result)
          return jsonResponse(response, 200, NavbarAlertsSummaryResponseSchema)
        } catch (err) {
          console.error('GET /api/operational-incidents/navbar-summary error:', err)
          return mapErrorToResponse(err)
        }
      },
    )
  }

  async function getKpis(): Promise<Response> {
    try {
      const result = await dashboardUseCases.getDashboardKpisReadModel()
      const response = {
        activeProcesses: result.activeProcesses,
        trackedContainers: result.trackedContainers,
        activeIncidents: result.activeIncidents,
        affectedContainers: result.affectedContainers,
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

      const windowSize = toDashboardMonthWindowSize(parsedQuery.data.window)
      const result = await dashboardUseCases.getProcessesCreatedByMonthReadModel(
        windowSize === undefined ? {} : { windowSize },
      )
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
    getNavbarOperationalIncidentsSummary,
    getKpis,
    getProcessesCreatedByMonth,
  }
}

export type DashboardControllers = ReturnType<typeof createDashboardControllers>
