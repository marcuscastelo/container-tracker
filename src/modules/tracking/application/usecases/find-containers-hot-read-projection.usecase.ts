import {
  type ContainersActiveAlertIncidentsProjection,
  findContainersActiveAlertIncidentsProjection,
  findContainersOperationalSummaryProjection,
  findContainersTimelineMainProjection,
} from '~/modules/tracking/application/projection/tracking.hot-read.projections'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import {
  collectSnapshotIdsForPilObservationEnrichment,
  enrichPilObservationsFromSnapshots,
  loadSnapshotsForPilObservationEnrichment,
} from '~/modules/tracking/application/usecases/pil-observation-read-enrichment'
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

export type ContainerHotReadProjection = {
  readonly containerId: string
  readonly containerNumber: string
  readonly status: ContainerStatus
  readonly timeline: readonly TrackingTimelineItem[]
  readonly operational: TrackingOperationalSummary
  readonly activeAlerts: readonly TrackingAlert[]
  readonly hasObservations: boolean
  readonly lastEventAt: TemporalValue | null
}

export type FindContainersHotReadProjectionCommand = {
  readonly containers: readonly ContainerTarget[]
  readonly now: Instant
}

export type FindContainersHotReadProjectionResult = {
  readonly containers: readonly ContainerHotReadProjection[]
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

function assertProjectionCoverage(
  containers: readonly ContainerTarget[],
  projectionName: string,
  projectedContainerIds: ReadonlySet<string>,
): void {
  const missingContainerIds = containers
    .map((container) => container.containerId)
    .filter((containerId) => !projectedContainerIds.has(containerId))

  if (missingContainerIds.length === 0) return

  throw new Error(`${projectionName} missing containers: ${missingContainerIds.join(', ')}`)
}

async function loadObservationsByContainerId(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
): Promise<ReadonlyMap<string, readonly Observation[]>> {
  const containerIds = containers.map((container) => container.containerId)
  if (containerIds.length === 0) return new Map()

  const observations = await deps.observationRepository.findAllByContainerIds(containerIds)
  return groupObservationsByContainerId(observations)
}

async function loadActiveAlerts(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
): Promise<readonly TrackingAlert[]> {
  const containerIds = containers.map((container) => container.containerId)
  if (containerIds.length === 0) return []

  return deps.trackingAlertRepository.findActiveByContainerIds(containerIds)
}

async function enrichObservationsByContainerId(
  deps: TrackingUseCasesDeps,
  containers: readonly ContainerTarget[],
  observationsByContainerId: ReadonlyMap<string, readonly Observation[]>,
): Promise<ReadonlyMap<string, readonly Observation[]>> {
  const enrichedEntries = await Promise.all(
    containers.map(async (container) => {
      const observations = observationsByContainerId.get(container.containerId) ?? []
      const snapshotIds = collectSnapshotIdsForPilObservationEnrichment(observations)
      if (snapshotIds.length === 0) {
        return [container.containerId, observations] as const
      }

      const snapshots = await loadSnapshotsForPilObservationEnrichment(
        deps,
        container.containerId,
        snapshotIds,
      )

      return [
        container.containerId,
        enrichPilObservationsFromSnapshots(observations, snapshots),
      ] as const
    }),
  )

  return new Map(enrichedEntries)
}

export async function findContainersHotReadProjection(
  deps: TrackingUseCasesDeps,
  command: FindContainersHotReadProjectionCommand,
): Promise<FindContainersHotReadProjectionResult> {
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

  const [observationsByContainerId, activeAlerts] = await Promise.all([
    loadObservationsByContainerId(deps, command.containers),
    loadActiveAlerts(deps, command.containers),
  ])
  const readEnrichedObservationsByContainerId = await enrichObservationsByContainerId(
    deps,
    command.containers,
    observationsByContainerId,
  )

  const timelineMain = findContainersTimelineMainProjection({
    containers: command.containers,
    observationsByContainerId: readEnrichedObservationsByContainerId,
    now: command.now,
  })
  const timelineMainByContainerId = new Map(
    timelineMain.map((container) => [container.containerId, container] as const),
  )
  assertProjectionCoverage(
    command.containers,
    'tracking.findContainersHotReadProjection.timeline',
    new Set(timelineMainByContainerId.keys()),
  )

  const operationalByContainerId = findContainersOperationalSummaryProjection({
    containers: command.containers,
    observationsByContainerId: readEnrichedObservationsByContainerId,
    timelineMainByContainerId,
    now: command.now,
  })
  assertProjectionCoverage(
    command.containers,
    'tracking.findContainersHotReadProjection.operational',
    new Set(operationalByContainerId.keys()),
  )

  const activeAlertProjection = findContainersActiveAlertIncidentsProjection({
    containers: command.containers,
    activeAlerts,
  })

  const containers = command.containers.map((container) => {
    const timelineProjection = timelineMainByContainerId.get(container.containerId)
    const operationalProjection = operationalByContainerId.get(container.containerId)

    if (timelineProjection === undefined || operationalProjection === undefined) {
      throw new Error(
        `tracking.findContainersHotReadProjection coverage mismatch for ${container.containerId}`,
      )
    }

    return {
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      status: timelineProjection.status,
      timeline: timelineProjection.timeline,
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
