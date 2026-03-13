import type { NavbarAlertsSummaryResponse } from '~/shared/api-schemas/dashboard.schemas'

type NavbarAlertDto = NavbarAlertsSummaryResponse['processes'][number]['containers'][number]['alerts'][number]

export type NavbarAlertVM = {
  readonly alertId: string
  readonly severity: NavbarAlertDto['severity']
  readonly category: NavbarAlertDto['category']
  readonly messageKey: NavbarAlertDto['message_key']
  readonly messageParams: NavbarAlertDto['message_params']
  readonly occurredAt: string
  readonly retroactive: boolean
}

export type NavbarContainerAlertGroupVM = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: string | null
  readonly eta: string | null
  readonly activeAlertsCount: number
  readonly dominantSeverity: NavbarAlertsSummaryResponse['processes'][number]['containers'][number]['dominant_severity']
  readonly latestAlertAt: string | null
  readonly alerts: readonly NavbarAlertVM[]
}

export type NavbarProcessAlertGroupVM = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeAlertsCount: number
  readonly dominantSeverity: NavbarAlertsSummaryResponse['processes'][number]['dominant_severity']
  readonly latestAlertAt: string | null
  readonly containers: readonly NavbarContainerAlertGroupVM[]
}

export type NavbarAlertsVM = {
  readonly totalAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
}

export function toNavbarAlertsVM(source: NavbarAlertsSummaryResponse): NavbarAlertsVM {
  return {
    totalAlerts: source.total_active_alerts,
    processes: source.processes.map((process) => ({
      processId: process.process_id,
      processReference: process.process_reference,
      carrier: process.carrier,
      routeSummary: process.route_summary,
      activeAlertsCount: process.active_alerts_count,
      dominantSeverity: process.dominant_severity,
      latestAlertAt: process.latest_alert_at,
      containers: process.containers.map((container) => ({
        containerId: container.container_id,
        containerNumber: container.container_number,
        status: container.status,
        eta: container.eta,
        activeAlertsCount: container.active_alerts_count,
        dominantSeverity: container.dominant_severity,
        latestAlertAt: container.latest_alert_at,
        alerts: container.alerts.map((alert) => ({
          alertId: alert.alert_id,
          severity: alert.severity,
          category: alert.category,
          messageKey: alert.message_key,
          messageParams: alert.message_params,
          occurredAt: alert.occurred_at,
          retroactive: alert.retroactive,
        })),
      })),
    })),
  }
}

export const EMPTY_NAVBAR_ALERTS_VM: NavbarAlertsVM = {
  totalAlerts: 0,
  processes: [],
}
