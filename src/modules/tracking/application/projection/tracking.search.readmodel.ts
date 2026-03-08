import { toTrackingObservationProjections } from '~/modules/tracking/application/projection/tracking.observation.projection'
import { deriveTrackingOperationalSummary } from '~/modules/tracking/application/projection/tracking.operational-summary.readmodel'
import { deriveTransshipment } from '~/modules/tracking/domain/derive/deriveAlerts'
import { deriveStatus } from '~/modules/tracking/domain/derive/deriveStatus'
import {
  compareObservationsChronologically,
  deriveTimeline,
} from '~/modules/tracking/domain/derive/deriveTimeline'
import type { ContainerStatus } from '~/modules/tracking/domain/model/containerStatus'
import type { Observation } from '~/modules/tracking/domain/model/observation'

export type TrackingSearchObservationProjection = Readonly<{
  processId: string
  observation: Observation
}>

export type TrackingSearchProjection = Readonly<{
  processId: string
  vesselName: string | null
  latestDerivedStatus: ContainerStatus
  latestEta: string | null
}>

type DeriveTrackingSearchProjectionsArgs = Readonly<{
  observations: readonly TrackingSearchObservationProjection[]
  now: Date
}>

type ContainerObservationGroup = {
  processId: string
  containerId: string
  containerNumber: string
  observations: Observation[]
}

function normalizeVesselName(vesselName: string | null): string | null {
  if (vesselName === null) return null
  const normalized = vesselName.trim()
  return normalized.length > 0 ? normalized : null
}

function groupByContainer(
  observations: readonly TrackingSearchObservationProjection[],
): Map<string, ContainerObservationGroup> {
  const grouped = new Map<string, ContainerObservationGroup>()

  for (const item of observations) {
    const existing = grouped.get(item.observation.container_id)
    if (existing) {
      existing.observations.push(item.observation)
      continue
    }

    grouped.set(item.observation.container_id, {
      processId: item.processId,
      containerId: item.observation.container_id,
      containerNumber: item.observation.container_number,
      observations: [item.observation],
    })
  }

  return grouped
}

function deriveLatestVesselName(observations: readonly Observation[]): string | null {
  const ordered = [...observations].sort(compareObservationsChronologically)

  for (let idx = ordered.length - 1; idx >= 0; idx -= 1) {
    const observation = ordered[idx]
    if (!observation) continue

    const vesselName = normalizeVesselName(observation.vessel_name)
    if (vesselName !== null) {
      return vesselName
    }
  }

  return null
}

export function deriveTrackingSearchProjections(
  args: DeriveTrackingSearchProjectionsArgs,
): readonly TrackingSearchProjection[] {
  const grouped = groupByContainer(args.observations)
  const projections: TrackingSearchProjection[] = []

  for (const group of grouped.values()) {
    const timeline = deriveTimeline(
      group.containerId,
      group.containerNumber,
      group.observations,
      args.now,
    )
    const latestDerivedStatus = deriveStatus(timeline)
    const transshipment = deriveTransshipment(timeline)
    const operational = deriveTrackingOperationalSummary({
      observations: toTrackingObservationProjections(group.observations),
      status: latestDerivedStatus,
      transshipment,
      now: args.now,
    })

    projections.push({
      processId: group.processId,
      vesselName: deriveLatestVesselName(group.observations),
      latestDerivedStatus,
      latestEta: operational.eta?.eventTimeIso ?? null,
    })
  }

  return projections
}
