export type DashboardGlobalAlertsVM = {
  readonly totalActiveIncidents: number
  readonly affectedContainersCount: number
  readonly recognizedIncidentsCount: number
  readonly bySeverity: {
    readonly danger: number
    readonly warning: number
    readonly info: number
  }
  readonly byCategory: {
    readonly eta: number
    readonly movement: number
    readonly customs: number
    readonly data: number
  }
}
