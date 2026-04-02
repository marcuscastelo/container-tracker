import {
  findContainersOperationalSummaryProjection as deriveContainersOperationalSummaryProjection,
  findContainersTimelineMainProjection,
} from '~/modules/tracking/application/projection/tracking.hot-read.projections'
import type { TrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { Instant } from '~/shared/time/instant'

export type FindContainersOperationalSummaryProjectionCommand = {
  readonly containers: readonly {
    readonly containerId: string
    readonly containerNumber: string
    readonly podLocationCode?: string | null
  }[]
  readonly now: Instant
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
  containers: FindContainersOperationalSummaryProjectionCommand['containers'],
  projectedContainerIds: ReadonlySet<string>,
): void {
  const missingContainerIds = containers
    .map((container) => container.containerId)
    .filter((containerId) => !projectedContainerIds.has(containerId))

  if (missingContainerIds.length === 0) return

  throw new Error(
    `tracking.findContainersOperationalSummaryProjection missing containers: ${missingContainerIds.join(', ')}`,
  )
}

export async function findContainersOperationalSummaryProjection(
  deps: TrackingUseCasesDeps,
  command: FindContainersOperationalSummaryProjectionCommand,
): Promise<Map<string, TrackingOperationalSummary>> {
  if (command.containers.length === 0) return new Map()

  const observations = await deps.observationRepository.findAllByContainerIds(
    command.containers.map((container) => container.containerId),
  )
  const observationsByContainerId = groupObservationsByContainerId(observations)
  const timelineMain = findContainersTimelineMainProjection({
    containers: command.containers,
    observationsByContainerId,
    now: command.now,
  })
  const timelineMainByContainerId = new Map(
    timelineMain.map((container) => [container.containerId, container] as const),
  )
  assertProjectionCoverage(command.containers, new Set(timelineMainByContainerId.keys()))

  const summariesByContainerId = deriveContainersOperationalSummaryProjection({
    containers: command.containers,
    observationsByContainerId,
    timelineMainByContainerId,
    now: command.now,
  })
  assertProjectionCoverage(command.containers, new Set(summariesByContainerId.keys()))

  return new Map(
    [...summariesByContainerId.entries()].map(([containerId, summary]) => [
      containerId,
      summary.operational,
    ]),
  )
}
