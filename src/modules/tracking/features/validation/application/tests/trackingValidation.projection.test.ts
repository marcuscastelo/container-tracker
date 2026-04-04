import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import {
  deriveTrackingValidationSummaryFromState,
  pickTopTrackingValidationIssueForProcess,
} from '~/modules/tracking/features/validation/application/projection/trackingValidation.projection'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeObservation(
  overrides: Partial<Observation> & Pick<Observation, 'id' | 'type' | 'created_at'>,
): Observation {
  return {
    id: overrides.id,
    fingerprint: overrides.fingerprint ?? `fp-${overrides.id}`,
    container_id: overrides.container_id ?? 'container-1',
    container_number: overrides.container_number ?? 'MSCU1234567',
    type: overrides.type,
    event_time: overrides.event_time ?? temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? 'BRIOA',
    location_display: overrides.location_display ?? 'Itapoa',
    vessel_name: overrides.vessel_name ?? null,
    voyage: overrides.voyage ?? null,
    is_empty: overrides.is_empty ?? false,
    confidence: overrides.confidence ?? 'high',
    provider: overrides.provider ?? 'msc',
    created_from_snapshot_id: overrides.created_from_snapshot_id ?? 'snapshot-1',
    carrier_label: overrides.carrier_label ?? null,
    raw_event_time: overrides.raw_event_time ?? null,
    event_time_source: overrides.event_time_source ?? null,
    created_at: overrides.created_at,
    retroactive: overrides.retroactive ?? false,
  }
}

describe('trackingValidation.projection', () => {
  it('exposes ordered active issues with public explanation metadata only', () => {
    const observations = [
      makeObservation({
        id: 'delivery-1',
        type: 'DELIVERY',
        created_at: '2026-04-01T10:00:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'delivery-2',
        type: 'DELIVERY',
        created_at: '2026-04-02T10:00:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        created_at: '2026-04-03T10:00:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
        location_code: 'ITNAP',
        location_display: 'Naples',
        vessel_name: 'MSC RESUME',
        voyage: '777E',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'MSCU1234567',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'MSCU1234567',
        observations,
        derived_at: '2026-04-04T10:00:00.000Z',
        holes: [],
      },
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-04T10:00:00.000Z'),
    })

    expect(summary).toMatchObject({
      hasIssues: true,
      findingCount: 2,
      highestSeverity: 'CRITICAL',
      topIssue: {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'BRIOA',
        affectedBlockLabelKey: null,
      },
    })
    expect(summary.activeIssues).toEqual([
      {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'BRIOA',
        affectedBlockLabelKey: null,
      },
      {
        code: 'POST_COMPLETION_TRACKING_CONTINUED',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.postCompletionTrackingContinued',
        affectedArea: 'timeline',
        affectedLocation: null,
        affectedBlockLabelKey: null,
      },
    ])
    expect(summary.activeIssues[0]).not.toHaveProperty('debugEvidence')
  })

  it('picks the compact dashboard top issue by severity and container order', () => {
    const result = pickTopTrackingValidationIssueForProcess([
      {
        containerNumber: 'MSCU2222222',
        topIssue: {
          code: 'CANONICAL_TIMELINE_CLASSIFICATION_INCONSISTENT',
          severity: 'ADVISORY',
          reasonKey: 'tracking.validation.canonicalTimelineClassificationInconsistent',
          affectedArea: 'timeline',
          affectedLocation: 'Santos',
          affectedBlockLabelKey: 'shipmentView.timeline.blocks.postCarriage',
        },
      },
      {
        containerNumber: 'MSCU1111111',
        topIssue: {
          code: 'POST_COMPLETION_TRACKING_CONTINUED',
          severity: 'CRITICAL',
          reasonKey: 'tracking.validation.postCompletionTrackingContinued',
          affectedArea: 'timeline',
          affectedLocation: null,
          affectedBlockLabelKey: null,
        },
      },
    ])

    expect(result).toEqual({
      code: 'POST_COMPLETION_TRACKING_CONTINUED',
      severity: 'CRITICAL',
      reasonKey: 'tracking.validation.postCompletionTrackingContinued',
      affectedArea: 'timeline',
      affectedLocation: null,
      affectedBlockLabelKey: null,
    })
  })

  it('surfaces the new advisory detectors through the compact projection without leaking technical detail', () => {
    const observations = [
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        location_code: 'CNSHA',
        location_display: 'Shanghai',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        created_at: '2026-04-01T10:30:00.000Z',
      }),
      makeObservation({
        id: 'arrival-actual',
        type: 'ARRIVAL',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        created_at: '2026-04-10T10:30:00.000Z',
      }),
      makeObservation({
        id: 'arrival-expected-late',
        type: 'ARRIVAL',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-11T10:00:00.000Z'),
        created_at: '2026-04-11T10:30:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'MSCU1234567',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'MSCU1234567',
        observations,
        derived_at: '2026-04-12T10:00:00.000Z',
        holes: [],
      },
      status: 'ARRIVED_AT_POD',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-12T10:00:00.000Z'),
    })

    expect(summary).toMatchObject({
      hasIssues: true,
      findingCount: 2,
      highestSeverity: 'ADVISORY',
      topIssue: {
        code: 'EXPECTED_PLAN_NOT_RECONCILABLE',
        severity: 'ADVISORY',
        reasonKey: 'tracking.validation.expectedPlanNotReconcilable',
        affectedArea: 'series',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    })
    expect(summary.activeIssues).toEqual([
      {
        code: 'EXPECTED_PLAN_NOT_RECONCILABLE',
        severity: 'ADVISORY',
        reasonKey: 'tracking.validation.expectedPlanNotReconcilable',
        affectedArea: 'series',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
      {
        code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
        severity: 'ADVISORY',
        reasonKey: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
        affectedArea: 'timeline',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    ])
    expect(summary.activeIssues[0]).not.toHaveProperty('debugEvidence')
  })
})
