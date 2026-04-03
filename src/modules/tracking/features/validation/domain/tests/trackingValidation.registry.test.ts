import { describe, expect, it } from 'vitest'
import type { TransshipmentInfo } from '~/modules/tracking/domain/logistics/transshipment'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ContainerStatus } from '~/modules/tracking/features/status/domain/model/containerStatus'
import type { Timeline } from '~/modules/tracking/features/timeline/domain/model/timeline'
import type { TrackingValidationContext } from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
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
    detect: () => findings,
  }
}

describe('tracking validation registry and aggregation', () => {
  it('keeps detector evaluation order deterministic and summarizes highest severity', () => {
    const registry = createTrackingValidationRegistry([
      createDetector('timeline-gap', [
        {
          detectorId: 'timeline-gap',
          code: 'timeline_gap',
          severity: 'warning',
          affectedScope: 'timeline',
        },
      ]),
      createDetector('status-conflict', [
        {
          detectorId: 'status-conflict',
          code: 'status_conflict',
          severity: 'danger',
          affectedScope: 'status',
        },
      ]),
    ])

    const result = deriveTrackingValidation({
      context: createContext(),
      registry,
    })

    expect(result.findings.map((finding) => finding.code)).toEqual([
      'timeline_gap',
      'status_conflict',
    ])
    expect(result.summary).toEqual({
      hasIssues: true,
      findingCount: 2,
      highestSeverity: 'danger',
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
        highestSeverity: 'warning',
      },
      {
        hasIssues: true,
        findingCount: 2,
        highestSeverity: 'danger',
      },
    ])

    expect(result).toEqual({
      hasIssues: true,
      affectedContainerCount: 2,
      totalFindingCount: 3,
      highestSeverity: 'danger',
    })
  })
})
