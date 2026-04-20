import { describe, expect, it } from 'vitest'
import {
  findTrackingTimeTravelSync,
  selectAdjacentTrackingTimeTravelSnapshotId,
} from '~/modules/process/ui/screens/shipment/lib/tracking-time-travel.selection.service'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'

function makeSync(snapshotId: string, position: number): TrackingTimeTravelSyncVM {
  return {
    snapshotId,
    fetchedAtIso: `2026-01-2${position}T10:00:00.000Z`,
    position,
    statusCode: 'IN_TRANSIT',
    statusVariant: 'in-transit',
    timeline: [],
    alerts: [],
    eta: null,
    currentContext: {
      locationCode: null,
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
    },
    nextLocation: null,
    diff:
      position === 1
        ? { kind: 'initial' }
        : {
            kind: 'comparison',
            statusChanged: false,
            previousStatusCode: 'IN_TRANSIT',
            currentStatusCode: 'IN_TRANSIT',
            timelineChanged: false,
            addedTimelineCount: 0,
            removedTimelineCount: 0,
            alertsChanged: false,
            newAlertsCount: 0,
            resolvedAlertsCount: 0,
            etaChanged: false,
            previousEta: null,
            currentEta: null,
            actualConflictAppeared: false,
            actualConflictResolved: false,
          },
    debugAvailable: true,
  }
}

describe('tracking time travel selection service', () => {
  it('returns null when the requested snapshot is missing', () => {
    expect(findTrackingTimeTravelSync([], 'snapshot-1')).toBeNull()
    expect(findTrackingTimeTravelSync([makeSync('snapshot-1', 1)], 'snapshot-2')).toBeNull()
  })

  it('returns null for previous/next navigation when there are zero or one syncs', () => {
    expect(
      selectAdjacentTrackingTimeTravelSnapshotId({
        syncs: [],
        currentSnapshotId: 'snapshot-1',
        direction: 'previous',
      }),
    ).toBeNull()

    expect(
      selectAdjacentTrackingTimeTravelSnapshotId({
        syncs: [makeSync('snapshot-1', 1)],
        currentSnapshotId: 'snapshot-1',
        direction: 'previous',
      }),
    ).toBeNull()

    expect(
      selectAdjacentTrackingTimeTravelSnapshotId({
        syncs: [makeSync('snapshot-1', 1)],
        currentSnapshotId: 'snapshot-1',
        direction: 'next',
      }),
    ).toBeNull()
  })

  it('navigates between chronological syncs when multiple checkpoints exist', () => {
    const syncs = [makeSync('snapshot-1', 1), makeSync('snapshot-2', 2), makeSync('snapshot-3', 3)]

    expect(findTrackingTimeTravelSync(syncs, 'snapshot-2')?.snapshotId).toBe('snapshot-2')
    expect(
      selectAdjacentTrackingTimeTravelSnapshotId({
        syncs,
        currentSnapshotId: 'snapshot-2',
        direction: 'previous',
      }),
    ).toBe('snapshot-1')
    expect(
      selectAdjacentTrackingTimeTravelSnapshotId({
        syncs,
        currentSnapshotId: 'snapshot-2',
        direction: 'next',
      }),
    ).toBe('snapshot-3')
  })
})
