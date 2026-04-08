import type {
  DashboardContainerRecordProjection,
  DashboardProcessUseCases,
  DashboardProcessWithOperationalSummaryProjection,
} from '~/capabilities/dashboard/application/dashboard.processes.projection'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type { TemporalValueDto } from '~/shared/time/dto'
import type { Instant } from '~/shared/time/instant'

export type DashboardNavbarSeverity = 'danger' | 'warning' | 'info' | 'success' | 'none'

export type DashboardTrackingUseCases = {
  listActiveAlertReadModel(): Promise<{
    readonly alerts: readonly TrackingActiveAlertReadModel[]
  }>
  findContainersOperationalSummaryProjection(command: {
    readonly containers: readonly {
      readonly containerId: string
      readonly containerNumber: string
      readonly podLocationCode?: string | null
    }[]
    readonly now: Instant
  }): Promise<Map<string, TrackingOperationalSummary>>
}

export type DashboardNavbarAlertsReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
  readonly trackingUseCases: DashboardTrackingUseCases
}

export type NavbarAlertMessageContract =
  | {
      readonly messageKey: 'alerts.transshipmentDetected'
      readonly messageParams: {
        readonly port: string
        readonly fromVessel: string
        readonly toVessel: string
      }
    }
  | {
      readonly messageKey: 'alerts.customsHoldDetected'
      readonly messageParams: {
        readonly location: string
      }
    }
  | {
      readonly messageKey: 'alerts.etaMissing'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.etaPassed'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.portChange'
      readonly messageParams: Readonly<Record<never, never>>
    }
  | {
      readonly messageKey: 'alerts.dataInconsistent'
      readonly messageParams: Readonly<Record<never, never>>
    }

export type NavbarAlertItemReadModel = {
  readonly alertId: string
  readonly severity: TrackingActiveAlertReadModel['severity']
  readonly category: TrackingActiveAlertReadModel['category']
  readonly occurredAt: string
  readonly retroactive: boolean
} & NavbarAlertMessageContract

export type NavbarContainerAlertGroupReadModel = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: string | null
  readonly eta: TemporalValueDto | null
  readonly activeAlertsCount: number
  readonly dominantSeverity: DashboardNavbarSeverity
  readonly latestAlertAt: string | null
  readonly alerts: readonly NavbarAlertItemReadModel[]
}

export type NavbarProcessAlertGroupReadModel = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly activeAlertsCount: number
  readonly dominantSeverity: DashboardNavbarSeverity
  readonly latestAlertAt: string | null
  readonly containers: readonly NavbarContainerAlertGroupReadModel[]
}

export type NavbarAlertsSummaryReadModel = {
  readonly totalActiveAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupReadModel[]
}

export type ProcessContext = {
  readonly process: DashboardProcessWithOperationalSummaryProjection['pwc']['process']
  readonly containersById: ReadonlyMap<string, DashboardContainerRecordProjection>
}

export type MutableContainerAccumulator = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: string | null
  readonly eta: TemporalValueDto | null
  readonly alerts: NavbarAlertItemReadModel[]
}

export type MutableProcessAccumulator = {
  readonly processId: string
  readonly processReference: string | null
  readonly carrier: string | null
  readonly routeSummary: string
  readonly containersById: Map<string, MutableContainerAccumulator>
}
