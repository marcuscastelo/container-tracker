import { describe, expect, it } from 'vitest'
import { canonicalTimelineClassificationInconsistentDetector } from '~/modules/tracking/features/validation/domain/detectors/canonicalTimelineClassificationInconsistent.detector'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import { Instant } from '~/shared/time/instant'

function makeContext(
  overrides: Partial<TrackingValidationContext> = {},
): TrackingValidationContext {
  return {
    containerId: 'container-1',
    containerNumber: 'MSCU1234567',
    observations: [],
    timeline: {
      container_id: 'container-1',
      container_number: 'MSCU1234567',
      observations: [],
      derived_at: '2026-04-03T12:00:00.000Z',
      holes: [],
    },
    status: 'DISCHARGED',
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

describe('canonicalTimelineClassificationInconsistentDetector', () => {
  it('does not emit a finding when no canonical timeline inconsistency signal exists', () => {
    const findings = canonicalTimelineClassificationInconsistentDetector.detect(makeContext())

    expect(findings).toEqual([])
  })

  it('emits one ADVISORY finding when post-carriage contains maritime events', () => {
    const findings = canonicalTimelineClassificationInconsistentDetector.detect(
      makeContext({
        derivedSignals: {
          canonicalTimeline: {
            postCarriageMaritimeEvents: [
              {
                type: 'ARRIVAL',
                eventTimeType: 'ACTUAL',
                location: 'Santos',
                hasVesselContext: true,
                hasVoyageContext: true,
              },
            ],
          },
        },
      }),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
      detectorVersion: '1',
      code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
      severity: 'ADVISORY',
      affectedScope: 'TIMELINE',
      summaryKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
      isActive: true,
      debugEvidence: {
        maritimeEventCount: 1,
        maritimeEventTypes: 'ARRIVAL',
        hasVesselContext: true,
        hasVoyageContext: true,
      },
    })
    expect(findings[0]?.evidenceSummary).toContain('Post-carriage block contains maritime events')
  })
})
