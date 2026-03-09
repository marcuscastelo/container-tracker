import type {
  TrackingAlert,
  TrackingAlertMessageContract,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

type TrackingAlertDisplaySourceBase = {
  readonly id: string
  readonly container_id: string
  readonly category: TrackingAlert['category']
  readonly type: TrackingAlert['type']
  readonly severity: TrackingAlert['severity']
  readonly detected_at: string
  readonly triggered_at: string
  readonly retroactive: boolean
  readonly provider: TrackingAlert['provider']
  readonly acked_at: string | null
}

export type TrackingAlertDisplaySource = TrackingAlertDisplaySourceBase &
  TrackingAlertMessageContract

export type TrackingAlertDisplayReadModel = TrackingAlertDisplaySource & {
  readonly container_number: string
}

type ResolveContainerNumber = (containerId: string) => string | null

function requireContainerNumber(
  containerId: string,
  resolveContainerNumber: ResolveContainerNumber,
): string {
  const maybeContainerNumber = resolveContainerNumber(containerId)
  if (maybeContainerNumber === null) {
    throw new Error(
      `tracking alert display projection: missing container number for container_id=${containerId}`,
    )
  }

  const containerNumber = maybeContainerNumber.trim()
  if (containerNumber.length === 0) {
    throw new Error(
      `tracking alert display projection: empty container number for container_id=${containerId}`,
    )
  }

  return containerNumber
}

export function toTrackingAlertDisplayReadModel(
  alert: TrackingAlertDisplaySource,
  resolveContainerNumber: ResolveContainerNumber,
): TrackingAlertDisplayReadModel {
  return {
    ...alert,
    container_number: requireContainerNumber(alert.container_id, resolveContainerNumber),
  }
}

export function toTrackingAlertDisplayReadModels(
  alerts: readonly TrackingAlertDisplaySource[],
  resolveContainerNumber: ResolveContainerNumber,
): readonly TrackingAlertDisplayReadModel[] {
  return alerts.map((alert) => toTrackingAlertDisplayReadModel(alert, resolveContainerNumber))
}
