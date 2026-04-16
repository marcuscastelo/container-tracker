import {
  resolveCurrentVoyage,
  toCurrentVoyageGroups,
} from '~/modules/process/ui/timeline/currentVoyage'
import { buildTimelineRenderList } from '~/modules/process/ui/timeline/timelineBlockModel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

function findLatestPreferredTimelineValue(
  timeline: readonly TrackingTimelineItem[],
  pickValue: (event: TrackingTimelineItem) => string | null | undefined,
): string | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event === undefined) continue

    const value = pickValue(event)
    if (value && event.eventTimeType === 'ACTUAL') {
      return value
    }
  }

  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event === undefined) continue

    const value = pickValue(event)
    if (value) {
      return value
    }
  }

  return null
}

export function deriveCurrentVesselFromTimeline(
  timeline: readonly TrackingTimelineItem[],
): string | null {
  return findLatestPreferredTimelineValue(timeline, (event) => event.vesselName ?? null)
}

export function deriveCurrentLocationFromTimeline(
  timeline: readonly TrackingTimelineItem[],
): string | null {
  return findLatestPreferredTimelineValue(timeline, (event) => event.location ?? null)
}

export function shouldHideCurrentVesselForCompletedLeg(
  timeline: readonly TrackingTimelineItem[],
): boolean {
  if (timeline.length === 0) return false

  const renderList = buildTimelineRenderList(timeline)
  const resolution = resolveCurrentVoyage(toCurrentVoyageGroups(renderList))

  if (resolution.endedByPostCarriage) return true
  if (resolution.currentVoyageHasActualDischarge) return true

  let latestActualDischargeIndex = -1
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event === undefined) continue

    if (event.type === 'DISCHARGE' && event.eventTimeType === 'ACTUAL') {
      latestActualDischargeIndex = i
      break
    }
  }

  if (latestActualDischargeIndex < 0) return false

  for (let i = latestActualDischargeIndex + 1; i < timeline.length; i++) {
    const event = timeline[i]
    if (event === undefined) continue

    if (
      event.eventTimeType === 'ACTUAL' &&
      (event.type === 'LOAD' || event.type === 'DEPARTURE' || event.type === 'ARRIVAL')
    ) {
      return false
    }
  }

  return true
}
