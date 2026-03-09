import { describe, expect, it } from 'vitest'
import {
  deriveCurrentLocationFromTimeline,
  deriveCurrentVesselFromTimeline,
  shouldHideCurrentVesselForCompletedLeg,
} from '~/modules/process/ui/utils/current-tracking-context'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'

function createTimelineEvent(
  overrides: {
    readonly id?: string
    readonly type?: TrackingTimelineItem['type']
    readonly eventTimeIso?: string | null
    readonly eventTimeType?: TrackingTimelineItem['eventTimeType']
    readonly derivedState?: TrackingTimelineItem['derivedState']
    readonly location?: string | null
    readonly vesselName?: string | null
    readonly carrierLabel?: string
    readonly voyage?: string | null
    readonly seriesHistory?: TrackingTimelineItem['seriesHistory']
  } = {},
): TrackingTimelineItem {
  return {
    id: overrides.id ?? 'evt-1',
    type: overrides.type ?? 'SYSTEM_CREATED',
    eventTimeIso: overrides.eventTimeIso ?? '2026-03-09T00:00:00Z',
    eventTimeType: overrides.eventTimeType ?? 'EXPECTED',
    derivedState: overrides.derivedState ?? 'ACTIVE_EXPECTED',
    location: overrides.location ?? undefined,
    vesselName: overrides.vesselName ?? null,
    carrierLabel: overrides.carrierLabel,
    voyage: overrides.voyage,
    seriesHistory: overrides.seriesHistory,
  }
}

describe('current tracking context', () => {
  it('prefers latest ACTUAL vessel over newer EXPECTED vessel', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({
        id: 'expected-newer',
        eventTimeType: 'EXPECTED',
        vesselName: 'Expected Vessel',
      }),
      createTimelineEvent({
        id: 'actual-older',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
        vesselName: 'Actual Vessel',
      }),
    ]

    expect(deriveCurrentVesselFromTimeline(timeline)).toBe('Actual Vessel')
  })

  it('falls back to latest available location when there is no ACTUAL location', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({
        id: 'expected-older',
        eventTimeType: 'EXPECTED',
        location: 'Santos',
      }),
      createTimelineEvent({
        id: 'expected-latest',
        eventTimeType: 'EXPECTED',
        location: 'Rotterdam',
      }),
    ]

    expect(deriveCurrentLocationFromTimeline(timeline)).toBe('Rotterdam')
  })

  it('returns null when timeline has no vessel or location values', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({ id: 'evt-1', vesselName: null, location: undefined }),
    ]

    expect(deriveCurrentVesselFromTimeline(timeline)).toBeNull()
    expect(deriveCurrentLocationFromTimeline(timeline)).toBeNull()
  })

  it('hides current vessel when post-carriage has ACTUAL events', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({
        id: 'load',
        type: 'LOAD',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
        vesselName: 'MSC Maya',
      }),
      createTimelineEvent({
        id: 'discharge',
        type: 'DISCHARGE',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      }),
      createTimelineEvent({
        id: 'gate-out',
        type: 'GATE_OUT',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      }),
    ]

    expect(shouldHideCurrentVesselForCompletedLeg(timeline)).toBe(true)
  })

  it('hides current vessel when only discharged voyage remains as fallback', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({
        id: 'load',
        type: 'LOAD',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      }),
      createTimelineEvent({
        id: 'discharge',
        type: 'DISCHARGE',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      }),
    ]

    expect(shouldHideCurrentVesselForCompletedLeg(timeline)).toBe(true)
  })

  it('keeps current vessel visible while an active voyage exists', () => {
    const timeline: readonly TrackingTimelineItem[] = [
      createTimelineEvent({
        id: 'load',
        type: 'LOAD',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
        vesselName: 'CMA Horizon',
      }),
      createTimelineEvent({
        id: 'departure',
        type: 'DEPARTURE',
        eventTimeType: 'ACTUAL',
        derivedState: 'ACTUAL',
      }),
    ]

    expect(shouldHideCurrentVesselForCompletedLeg(timeline)).toBe(false)
  })
})
