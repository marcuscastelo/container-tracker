import {
  type ContainerOperationalSummaryProjection,
  type ContainersActiveAlertIncidentsProjection,
  findContainersActiveAlertIncidentsProjection,
  findContainersOperationalSummaryProjection,
  findContainersTimelineMainProjection,
} from '~/modules/tracking/application/projection/tracking.hot-read.projections'
import {
  createTrackingOperationalSummaryFallback,
  type TrackingOperationalSummary,
} from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import type { Instant } from '~/shared/time/instant'
import type { TemporalValue } from '~/shared/time/temporal-value'

type ContainerTarget = {
  readonly containerId: string
  readonly containerNumber: string
  readonly podLocationCode?: string | null
}

export type ContainerLeanTrackingProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: ContainerStatus
  readonly timeline: readonly TrackingTimelineItem[]
  readonly operational: TrackingOperationalSummary
  readonly activeAlerts: readonly TrackingAlert[]
  readonly hasObservations: boolean
  readonly lastEventAt: TemporalValue | null
}

export type FindContainersLeanTrackingProjectionCommand = {
  readonly containers: readonly ContainerTarget[]
  readonly now: Instant
}

export type FindContainersLeanTrackingProjectionResult = {
  readonly containers: readonly ContainerLeanTrackingProjection[]
  readonly activeAlertIncidents: ContainersActiveAlertIncidentsProjection['activeAlertIncidents']
  readonly activeAlerts: readonly TrackingAlert[]
}

function groupObservationsByContainerId(
  observations: readonly Observation[],
): ReadonlyMap<string, readonly Observation[]> {
  const grouped = new Map<string, Observation[]>()

  for (const observation of observations) {
    const existing = grouped.get(observation.container_id)
    if (existing === undefined) {
      grouped.set(observation.container_id, [observation])
      continue
    }

    existing.push(observation)
  }

  return grouped
}

function toFallbackOperationalProjection(
  container: ContainerTarget,
): ContainerOperationalSummaryProjection {
  return {
    containerId: container.containerId,
    containerNumber: container.containerNumber,
    status: 'UNKNOWN',
    operational: createTrackingOperationalSummaryFallback(true),
    hasObservations: false,
    lastEventAt: null,
  }
}

async function loadObservationsByContainerId(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
): Promise<ReadonlyMap<string, readonly Observation[]>> {
  const containerIds = containers.map((container) => container.containerId)
  if (containerIds.length === 0) return new Map()

  if (deps.observationRepository.findAllByContainerIds) {
    const observations = await deps.observationRepository.findAllByContainerIds(containerIds)
    return groupObservationsByContainerId(observations)
  }

  const observationsByContainerId = new Map<string, readonly Observation[]>()
  await Promise.all(
    containers.map(async (container) => {
      const observations = await deps.observationRepository.findAllByContainerId(
        container.containerId,
      )
      observationsByContainerId.set(container.containerId, observations)
    }),
  )

  return observationsByContainerId
}

async function loadActiveAlerts(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
): Promise<readonly TrackingAlert[]> {
  const containerIds = containers.map((container) => container.containerId)
  if (containerIds.length === 0) return []

  if (deps.trackingAlertRepository.findActiveByContainerIds) {
    return deps.trackingAlertRepository.findActiveByContainerIds(containerIds)
  }

  const results = await Promise.all(
    containers.map((container) =>
      deps.trackingAlertRepository.findActiveByContainerId(container.containerId),
    ),
  )
  return results.flat()
}

export async function findContainersLeanTrackingProjection(
  deps: TrackingUseCasesDeps,
  command: FindContainersLeanTrackingProjectionCommand,
): Promise<FindContainersLeanTrackingProjectionResult> {
  if (command.containers.length === 0) {
    return {
      containers: [],
      activeAlertIncidents: {
        summary: {
          activeIncidentCount: 0,
          affectedContainerCount: 0,
          recognizedIncidentCount: 0,
        },
        active: [],
        recognized: [],
      },
      activeAlerts: [],
    }
  }

  const observationsByContainerId = await loadObservationsByContainerId(deps, command.containers)

  let activeAlerts: readonly TrackingAlert[] = []
  let dataIssueByContainerId: ReadonlyMap<string, boolean> = new Map()
  try {
    activeAlerts = await loadActiveAlerts(deps, command.containers)
  } catch (error) {
    console.error('tracking.findContainersLeanTrackingProjection.activeAlerts_failed', {
      containerCount: command.containers.length,
      error: error instanceof Error ? error.message : String(error),
    })
    dataIssueByContainerId = new Map(
      command.containers.map((container) => [container.containerId, true] as const),
    )
  }

  const timelineMain = findContainersTimelineMainProjection({
    containers: command.containers,
    observationsByContainerId,
    now: command.now,
  })
  const timelineMainByContainerId = new Map(
    timelineMain.map((container) => [container.containerId, container] as const),
  )
  const operationalByContainerId = findContainersOperationalSummaryProjection({
    containers: command.containers,
    observationsByContainerId,
    timelineMainByContainerId,
    dataIssueByContainerId,
    now: command.now,
  })
  const activeAlertProjection = findContainersActiveAlertIncidentsProjection({
    containers: command.containers,
    activeAlerts,
  })

  const containers = command.containers.map((container) => {
    const timelineProjection = timelineMainByContainerId.get(container.containerId)
    const operationalProjection =
      operationalByContainerId.get(container.containerId) ??
      toFallbackOperationalProjection(container)

    const timeline = timelineProjection?.timeline ?? []
    const status = timelineProjection?.status ?? 'UNKNOWN'

    return {
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      status,
      timeline,
      operational: operationalProjection.operational,
      activeAlerts:
        activeAlertProjection.activeAlertsByContainerId.get(container.containerId) ?? [],
      hasObservations: operationalProjection.hasObservations,
      lastEventAt: operationalProjection.lastEventAt,
    }
  })

  return {
    containers,
    activeAlertIncidents: activeAlertProjection.activeAlertIncidents,
    activeAlerts: activeAlertProjection.activeAlerts,
  }
}
