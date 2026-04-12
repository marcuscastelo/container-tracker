import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'

type NavbarIncidentDto = NavbarAlertsSummaryData['processes'][number]['incidents'][number]

export type NavbarIncidentVM = {
  readonly incidentKey: string
  readonly type: NavbarIncidentDto['type']
  readonly severity: NavbarIncidentDto['severity']
  readonly category: NavbarIncidentDto['category']
  readonly factMessageKey: NavbarIncidentDto['fact']['message_key']
  readonly factMessageParams: NavbarIncidentDto['fact']['message_params']
  readonly action:
    | {
        readonly actionKey: NonNullable<NavbarIncidentDto['action']>['action_key']
        readonly actionParams: NonNullable<NavbarIncidentDto['action']>['action_params']
        readonly actionKind: NonNullable<NavbarIncidentDto['action']>['action_kind']
      }
    | null
  readonly affectedContainerCount: number
  readonly triggeredAt: string
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly lifecycleState: 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED'
  }[]
}

export type NavbarProcessAlertGroupVM = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeIncidentCount: number
  readonly affectedContainerCount: number
  readonly dominantSeverity: NavbarAlertsSummaryData['processes'][number]['dominant_severity']
  readonly latestIncidentAt: string | null
  readonly incidents: readonly NavbarIncidentVM[]
}

export type NavbarAlertsVM = {
  readonly totalActiveIncidents: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
}
export const EMPTY_NAVBAR_ALERTS_VM: NavbarAlertsVM = {
  totalActiveIncidents: 0,
  processes: [],
}
