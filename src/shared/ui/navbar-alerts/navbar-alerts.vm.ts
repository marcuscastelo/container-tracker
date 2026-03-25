import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import type { TemporalValueDto } from '~/shared/time/dto'

type NavbarAlertDto =
  NavbarAlertsSummaryData['processes'][number]['containers'][number]['alerts'][number]

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
  readonly eta: TemporalValueDto | null
  readonly activeAlertsCount: number
  readonly dominantSeverity: NavbarAlertsSummaryData['processes'][number]['containers'][number]['dominant_severity']
  readonly latestAlertAt: string | null
  readonly alerts: readonly NavbarAlertVM[]
}

export type NavbarProcessAlertGroupVM = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeAlertsCount: number
  readonly dominantSeverity: NavbarAlertsSummaryData['processes'][number]['dominant_severity']
  readonly latestAlertAt: string | null
  readonly containers: readonly NavbarContainerAlertGroupVM[]
}

export type NavbarAlertsVM = {
  readonly totalAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
}
export const EMPTY_NAVBAR_ALERTS_VM: NavbarAlertsVM = {
  totalAlerts: 0,
  processes: [],
}
