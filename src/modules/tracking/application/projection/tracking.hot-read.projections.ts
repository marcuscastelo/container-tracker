import { suppressSupersededObservationsForProjection } from '~/modules/tracking/application/projection/tracking.observation-visibility.readmodel'
import {
  deriveTrackingOperationalSummary,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import {
  buildShipmentAlertIncidentsReadModel,
  type ShipmentAlertIncidentsReadModel,
} from '~/modules/tracking/application/projection/tracking.shipment-alert-incidents.readmodel'
import { deriveTransshipment } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { toTrackingObservationProjections } from '~/modules/tracking/features/observation/application/projection/tracking.observation.projection'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveStatus } from '~/modules/tracking/features/status/domain/derive/deriveStatus'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import {
  deriveTimelineWithSeriesReadModel,
  type TrackingTimelineItem,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import {
  createTrackingValidationContext,
  deriveTrackingValidationProjection,
  type TrackingValidationContainerProjection,
} from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

type ContainerTarget = {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode?: string | null
}

export type ContainerTimelineMainProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly timeline: readonly TrackingTimelineItem[]
  readonly domainTimeline: Timeline
  readonly status: ContainerStatus
  readonly hasObservations: boolean
  readonly lastEventAt: TemporalValue | null
}

export type ContainerOperationalSummaryProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: ContainerStatus
  readonly operational: TrackingOperationalSummary
  readonly hasObservations: boolean
  readonly lastEventAt: TemporalValue | null
}

export type ContainerTrackingValidationProjection = TrackingValidationContainerProjection

export type ContainersActiveAlertIncidentsProjection = {
  readonly activeAlerts: readonly TrackingAlert[]
  readonly activeAlertIncidents: ShipmentAlertIncidentsReadModel
  readonly activeAlertsByContainerId: ReadonlyMap<string, readonly TrackingAlert[]>
}

function toLastEventAt(timeline: Timeline): TemporalValue | null {
  const latestObservation = timeline.observations[timeline.observations.length - 1]
  return latestObservation?.event_time ?? null
}

function groupActiveAlertsByContainerId(
  activeAlerts: readonly TrackingAlert[],
): ReadonlyMap<string, readonly TrackingAlert[]> {
  const grouped = new Map<string, TrackingAlert[]>()

  for (const alert of activeAlerts) {
    const existing = grouped.get(alert.container_id)
    if (existing === undefined) {
      grouped.set(alert.container_id, [alert])
      continue
    }

    existing.push(alert)
  }

  return grouped
}

export function findContainersTimelineMainProjection(command: {
  readonly containers: readonly ContainerTarget[]
  readonly observationsByContainerId: ReadonlyMap<string, readonly Observation[]>
  readonly now: Instant
}): readonly ContainerTimelineMainProjection[] {
  return command.containers.map((container) => {
    const observations = command.observationsByContainerId.get(container.containerId) ?? []
    const projectionObservations = suppressSupersededObservationsForProjection(observations)
    const domainTimeline = deriveTimeline(
      container.containerId,
      container.containerNumber,
      projectionObservations,
      command.now,
    )
    const timeline = deriveTimelineWithSeriesReadModel(
      toTrackingObservationProjections(projectionObservations),
      command.now,
      { includeSeriesHistory: false },
    )
    const status = deriveStatus(domainTimeline)

    return {
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      timeline,
      domainTimeline,
      status,
      hasObservations: observations.length > 0,
      lastEventAt: toLastEventAt(domainTimeline),
    }
  })
}

export function findContainersOperationalSummaryProjection(command: {
  readonly containers: readonly ContainerTarget[]
  readonly observationsByContainerId: ReadonlyMap<string, readonly Observation[]>
  readonly timelineMainByContainerId: ReadonlyMap<string, ContainerTimelineMainProjection>
  readonly dataIssueByContainerId?: ReadonlyMap<string, boolean>
  readonly now: Instant
}): ReadonlyMap<string, ContainerOperationalSummaryProjection> {
  const summariesByContainerId = new Map<string, ContainerOperationalSummaryProjection>()

  for (const container of command.containers) {
    const observations = command.observationsByContainerId.get(container.containerId) ?? []
    const projectionObservations = suppressSupersededObservationsForProjection(observations)
    const timelineProjection = command.timelineMainByContainerId.get(container.containerId)
    if (timelineProjection === undefined) continue

    const transshipment = deriveTransshipment(timelineProjection.domainTimeline)
    const operational = deriveTrackingOperationalSummary({
      observations: toTrackingObservationProjections(projectionObservations),
      status: timelineProjection.status,
      transshipment,
      podLocationCode: container.podLocationCode ?? null,
      now: command.now,
      dataIssue: command.dataIssueByContainerId?.get(container.containerId) ?? false,
    })

    summariesByContainerId.set(container.containerId, {
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      status: timelineProjection.status,
      operational,
      hasObservations: timelineProjection.hasObservations,
      lastEventAt: timelineProjection.lastEventAt,
    })
  }

  return summariesByContainerId
}

export function findContainersTrackingValidationProjection(command: {
  readonly containers: readonly ContainerTarget[]
  readonly observationsByContainerId: ReadonlyMap<string, readonly Observation[]>
  readonly timelineMainByContainerId: ReadonlyMap<string, ContainerTimelineMainProjection>
  readonly now: Instant
}): ReadonlyMap<string, ContainerTrackingValidationProjection> {
  const validationByContainerId = new Map<string, ContainerTrackingValidationProjection>()

  for (const container of command.containers) {
    const observations = command.observationsByContainerId.get(container.containerId) ?? []
    const projectionObservations = suppressSupersededObservationsForProjection(observations)
    const timelineProjection = command.timelineMainByContainerId.get(container.containerId)
    if (timelineProjection === undefined) continue

    const transshipment = deriveTransshipment(timelineProjection.domainTimeline)
    const validation = deriveTrackingValidationProjection(
      createTrackingValidationContext({
        containerId: container.containerId,
        containerNumber: container.containerNumber,
        observations: projectionObservations,
        timeline: timelineProjection.domainTimeline,
        status: timelineProjection.status,
        transshipment,
        now: command.now,
      }),
    )

    validationByContainerId.set(container.containerId, validation)
  }

  return validationByContainerId
}

export function findContainersActiveAlertIncidentsProjection(command: {
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
  }[]
  readonly activeAlerts: readonly TrackingAlert[]
}): ContainersActiveAlertIncidentsProjection {
  const activeAlertsByContainerId = groupActiveAlertsByContainerId(command.activeAlerts)
  const activeAlertIncidents = buildShipmentAlertIncidentsReadModel({
    containers: command.containers.map((container) => ({
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      alerts: activeAlertsByContainerId.get(container.containerId) ?? [],
    })),
  })

  return {
    activeAlerts: command.activeAlerts,
    activeAlertIncidents,
    activeAlertsByContainerId,
  }
}
