import { describe, expect, it } from 'vitest'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import type { TrackingValidationDetector } from '~/modules/tracking/features/validation/domain/model/trackingValidationDetector'
import { createTrackingValidationRegistry } from '~/modules/tracking/features/validation/domain/registry/trackingValidationRegistry'
import { aggregateTrackingValidation } from '~/modules/tracking/features/validation/domain/services/aggregateTrackingValidation'
import { deriveTrackingValidation } from '~/modules/tracking/features/validation/domain/services/deriveTrackingValidation'
import { Instant } from '~/shared/time/instant'

function createContext(
  overrides: Partial<TrackingValidationContext> = {},
): TrackingValidationContext {
  const observations: readonly Observation[] = []
  const timeline: Timeline = {
    container_id: 'container-1',
    container_number: 'MSCU1234567',
    observations,
    derived_at: '2026-04-03T00:00:00.000Z',
    holes: [],
  }
  const status: ContainerStatus = 'UNKNOWN'
  const transshipment: TransshipmentInfo = {
    hasTransshipment: false,
    transshipmentCount: 0,
    ports: [],
  }

  return {
    containerId: 'container-1',
    containerNumber: 'MSCU1234567',
    observations,
    timeline,
    status,
    transshipment,
    derivedSignals: createEmptyTrackingValidationDetectorSignals(),
    now: Instant.fromIso('2026-04-03T00:00:00.000Z'),
    ...overrides,
  }
}

function createDetector(
  id: string,
  findings: ReturnType<TrackingValidationDetector['detect']>,
): TrackingValidationDetector {
  return {
    id,
    version: '1',
    detect: () => findings,
  }
}

describe('tracking validation registry and aggregation', () => {
  it('keeps detector evaluation order deterministic and summarizes highest severity', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('TIMELINE_GAP', [
        {
          detectorId: 'TIMELINE_GAP',
          detectorVersion: '1',
          code: 'TIMELINE_GAP',
          lifecycleKey: 'TIMELINE_GAP:container-1',
          stateFingerprint: 'fp-timeline-gap',
          severity: 'ADVISORY',
          affectedScope: 'TIMELINE',
          summaryKey: 'tracking.validation.timelineGap',
          evidenceSummary: 'Gap in canonical timeline.',
          isActive: true,
        },
      ]),
      createDetector('STATUS_CONFLICT', [
        {
          detectorId: 'STATUS_CONFLICT',
          detectorVersion: '1',
          code: 'STATUS_CONFLICT',
          lifecycleKey: 'STATUS_CONFLICT:container-1',
          stateFingerprint: 'fp-status-conflict',
          severity: 'CRITICAL',
          affectedScope: 'STATUS',
          summaryKey: 'tracking.validation.statusConflict',
          evidenceSummary: 'Conflicting status facts.',
          isActive: true,
        },
      ]),
    ])

    const result = deriveTrackingValidation({
      context: createContext(),
      registry,
    })

    expect(result.findings.map((finding) => finding.code)).toEqual([
      'TIMELINE_GAP',
      'STATUS_CONFLICT',
    ])
    expect(result.summary).toEqual({
      hasIssues: true,
      findingCount: 2,
      highestSeverity: 'CRITICAL',
    })
  })

  it('ignores inactive findings when summarizing the active container state', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('INACTIVE_DETECTOR', [
        {
          detectorId: 'INACTIVE_DETECTOR',
          detectorVersion: '1',
          code: 'INACTIVE_DETECTOR',
          lifecycleKey: 'INACTIVE_DETECTOR:container-1',
          stateFingerprint: 'fp-inactive',
          severity: 'CRITICAL',
          affectedScope: 'SERIES',
          summaryKey: 'tracking.validation.inactiveFinding',
          evidenceSummary: 'Inactive finding kept for audit only.',
          isActive: false,
        },
      ]),
    ])

    const result = deriveTrackingValidation({
      context: createContext(),
      registry,
    })

    expect(result.findings).toHaveLength(1)
    expect(result.summary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
    })
  })

  it('aggregates container summaries into a process summary without redefining semantics', () => {
    const result = aggregateTrackingValidation([
      {
        hasIssues: false,
        findingCount: 0,
        highestSeverity: null,
      },
      {
        hasIssues: true,
        findingCount: 1,
        highestSeverity: 'ADVISORY',
      },
      {
        hasIssues: true,
        findingCount: 2,
        highestSeverity: 'CRITICAL',
      },
    ])

    expect(result).toEqual({
      hasIssues: true,
      affectedContainerCount: 2,
      totalFindingCount: 3,
      highestSeverity: 'CRITICAL',
    })
  })

  it('keeps advisory summaries active without escalating process severity to critical', () => {
    const result = aggregateTrackingValidation([
      {
        hasIssues: true,
        findingCount: 1,
        highestSeverity: 'ADVISORY',
      },
    ])

    expect(result).toEqual({
      hasIssues: true,
      affectedContainerCount: 1,
      totalFindingCount: 1,
      highestSeverity: 'ADVISORY',
    })
  })

  it('preserves debugEvidence internally while keeping the summary compact', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('TIMELINE_GAP', [
        {
          detectorId: 'TIMELINE_GAP',
          detectorVersion: '1',
          code: 'TIMELINE_GAP',
          lifecycleKey: 'TIMELINE_GAP:container-1',
          stateFingerprint: 'fp-timeline-gap',
          severity: 'ADVISORY',
          affectedScope: 'TIMELINE',
          summaryKey: 'tracking.validation.timelineGap',
          evidenceSummary: 'Gap in canonical timeline.',
          debugEvidence: {
            gapCount: 2,
            source: 'projection',
          },
          isActive: true,
        },
      ]),
    ])

    const result = deriveTrackingValidation({
      context: createContext(),
      registry,
    })

    expect(result.findings[0]?.debugEvidence).toEqual({
      gapCount: 2,
      source: 'projection',
    })
    expect(result.summary).toEqual({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'ADVISORY',
    })
  })

  it('rejects detector ids outside the UPPER_SNAKE_CASE convention', () => {
    expect(() => createTrackingValidationRegistry([createDetector('timeline-gap', [])])).toThrow(
      'UPPER_SNAKE_CASE',
    )
  })

  it('rejects findings whose code diverges from the detector id', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('TIMELINE_GAP', [
        {
          detectorId: 'TIMELINE_GAP',
          detectorVersion: '1',
          code: 'TIMELINE_GAP_DETAIL',
          lifecycleKey: 'TIMELINE_GAP:container-1',
          stateFingerprint: 'fp-timeline-gap',
          severity: 'ADVISORY',
          affectedScope: 'TIMELINE',
          summaryKey: 'tracking.validation.timelineGap',
          evidenceSummary: 'Gap in canonical timeline.',
          isActive: true,
        },
      ]),
    ])

    expect(() =>
      deriveTrackingValidation({
        context: createContext(),
        registry,
      }),
    ).toThrow('finding code mismatch')
  })

  it('rejects findings whose evidenceSummary is too long for the compact product contract', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('TIMELINE_GAP', [
        {
          detectorId: 'TIMELINE_GAP',
          detectorVersion: '1',
          code: 'TIMELINE_GAP',
          lifecycleKey: 'TIMELINE_GAP:container-1',
          stateFingerprint: 'fp-timeline-gap',
          severity: 'ADVISORY',
          affectedScope: 'TIMELINE',
          summaryKey: 'tracking.validation.timelineGap',
          evidenceSummary: 'A'.repeat(201),
          isActive: true,
        },
      ]),
    ])

    expect(() =>
      deriveTrackingValidation({
        context: createContext(),
        registry,
      }),
    ).toThrow('evidenceSummary exceeds 200 characters')
  })
})
