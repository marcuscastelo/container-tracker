export type DashboardGlobalAlertsVM = {
  readonly totalActiveAlerts: number
  readonly bySeverity: {
    readonly danger: number
    readonly warning: number
    readonly info: number
    readonly success: number
  }
  readonly byCategory: {
    readonly eta: number
    readonly movement: number
    readonly customs: number
    readonly status: number
    readonly data: number
  }
}
