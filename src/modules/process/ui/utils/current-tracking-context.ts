import type { TrackingTimelineItem } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'

function findLatestPreferredTimelineValue(
  timeline: readonly TrackingTimelineItem[],
  pickValue: (event: TrackingTimelineItem) => string | null | undefined,
): string | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    const value = pickValue(event)
    if (value && event.eventTimeType === 'ACTUAL') {
      return value
    }
  }

  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
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
