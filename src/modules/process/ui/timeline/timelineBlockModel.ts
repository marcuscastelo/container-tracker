import {
  buildTimelineRenderList as buildTimelineRenderListFromTracking,
  type GapMarker as TrackingGapMarker,
  type PortRiskMarker as TrackingPortRiskMarker,
  type TerminalBlock as TrackingTerminalBlock,
  type TerminalSegmentKind as TrackingTerminalSegmentKind,
  type TimelineRenderItem as TrackingTimelineRenderItem,
  type TransshipmentBlock as TrackingTransshipmentBlock,
  type VoyageBlock as TrackingVoyageBlock,
} from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.blocks.readmodel'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { systemClock } from '~/shared/time/clock'
import type { Instant } from '~/shared/time/instant'

export type GapMarker = TrackingGapMarker
export type PortRiskMarker = TrackingPortRiskMarker
export type TerminalBlock = TrackingTerminalBlock
export type TerminalSegmentKind = TrackingTerminalSegmentKind
export type TimelineRenderItem = TrackingTimelineRenderItem
export type TransshipmentBlock = TrackingTransshipmentBlock
export type VoyageBlock = TrackingVoyageBlock

export function buildTimelineRenderList(
  events: readonly TrackingTimelineItem[],
  now: Instant = systemClock.now(),
): readonly TimelineRenderItem[] {
  return buildTimelineRenderListFromTracking(events, now)
}
