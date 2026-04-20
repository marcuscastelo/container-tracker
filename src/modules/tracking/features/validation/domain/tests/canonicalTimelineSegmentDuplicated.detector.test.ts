import { describe, expect, it } from 'vitest'
import { canonicalTimelineSegmentDuplicatedDetector } from '~/modules/tracking/features/validation/domain/detectors/canonicalTimelineSegmentDuplicated.detector'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationCanonicalTimelineSegmentDuplicatedSignal,
  type TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import { Instant } from '~/shared/time/instant'

function makeSignal(
  overrides: Partial<TrackingValidationCanonicalTimelineSegmentDuplicatedSignal> = {},
): TrackingValidationCanonicalTimelineSegmentDuplicatedSignal {
  return {
    vessel: 'CMA CGM KRYPTON',
    voyage: 'VCGK0001W',
    identityKey: 'CMA CGM KRYPTON|VCGK0001W|QINGDAO',
    blocks: [
      {
        order: 1,
        origin: 'QINGDAO',
        destination: 'SANTOS',
        timelineItemIds: ['load-1', 'discharge-1'],
      },
      {
        order: 2,
        origin: 'QINGDAO',
        destination: 'SANTOS',
        timelineItemIds: ['load-2', 'discharge-2'],
      },
    ],
    repeatedMilestones: [
      {
        type: 'LOAD',
        eventTimeType: 'ACTUAL',
        location: 'QINGDAO',
        timelineItemIds: ['load-1', 'load-2'],
      },
      {
        type: 'DISCHARGE',
        eventTimeType: 'EXPECTED',
        location: 'SANTOS',
        timelineItemIds: ['discharge-1', 'discharge-2'],
      },
    ],
    includesLatestVoyageBlock: true,
    ...overrides,
  }
}

function makeContext(
  overrides: Partial<TrackingValidationContext> = {},
): TrackingValidationContext {
  return {
    containerId: 'container-1',
    containerNumber: 'PCIU8712104',
    observations: [],
    timeline: {
      container_id: 'container-1',
      container_number: 'PCIU8712104',
      observations: [],
      derived_at: '2026-04-03T12:00:00.000Z',
      holes: [],
    },
    status: 'IN_TRANSIT',
    transshipment: {
      hasTransshipment: false,
      transshipmentCount: 0,
      ports: [],
    },
    derivedSignals: createEmptyTrackingValidationDetectorSignals(),
    now: Instant.fromIso('2026-04-03T12:00:00.000Z'),
    ...overrides,
  }
}

describe('canonicalTimelineSegmentDuplicatedDetector', () => {
  it('emits one CRITICAL finding for duplicated current voyage blocks', () => {
    const findings = canonicalTimelineSegmentDuplicatedDetector.detect(
      makeContext({
        derivedSignals: {
          canonicalTimeline: {
            postCarriageMaritimeEvents: [],
            duplicatedSegments: [makeSignal()],
          },
        },
      }),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
      detectorVersion: '1',
      code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
      severity: 'CRITICAL',
      affectedScope: 'TIMELINE',
      summaryKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
      affectedLocation: 'SANTOS',
      affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
      isActive: true,
      debugEvidence: {
        vessel: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        duplicatedBlockCount: 2,
        blockOrders: '1,2',
        includesLatestVoyageBlock: true,
      },
    })
    expect(findings[0]?.lifecycleKey).toContain('CANONICAL_TIMELINE_SEGMENT_DUPLICATED:container-1')
    expect(findings[0]?.evidenceSummary).toContain('duplicated LOAD and DISCHARGE EXPECTED')
  })

  it('keeps duplicated historical segments as ADVISORY when they do not affect the latest active leg', () => {
    const findings = canonicalTimelineSegmentDuplicatedDetector.detect(
      makeContext({
        status: 'IN_TRANSIT',
        derivedSignals: {
          canonicalTimeline: {
            postCarriageMaritimeEvents: [],
            duplicatedSegments: [makeSignal({ includesLatestVoyageBlock: false })],
          },
        },
      }),
    )

    expect(findings[0]?.severity).toBe('ADVISORY')
  })

  it('does not emit a finding when no duplicated segment signal exists', () => {
    expect(canonicalTimelineSegmentDuplicatedDetector.detect(makeContext())).toEqual([])
  })
})
