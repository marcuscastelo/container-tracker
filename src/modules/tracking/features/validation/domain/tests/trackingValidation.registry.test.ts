import { describe, expect, it } from 'vitest'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import {
  createEmptyTrackingValidationDerivedSignals,
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
    signals: createEmptyTrackingValidationDerivedSignals(),
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
      createDetector('timeline-gap', [
        {
          detectorId: 'timeline-gap',
          detectorVersion: '1',
          code: 'TIMELINE_GAP',
          severity: 'ADVISORY',
          affectedScope: 'TIMELINE',
          summaryKey: 'tracking.validation.timelineGap',
          evidenceSummary: 'Gap in canonical timeline.',
          isActive: true,
        },
      ]),
      createDetector('status-conflict', [
        {
          detectorId: 'status-conflict',
          detectorVersion: '1',
          code: 'STATUS_CONFLICT',
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
      createDetector('inactive-detector', [
        {
          detectorId: 'inactive-detector',
          detectorVersion: '1',
          code: 'INACTIVE_FINDING',
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
})
