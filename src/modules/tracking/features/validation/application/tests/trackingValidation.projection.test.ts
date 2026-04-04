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

  it('suppresses the missing milestone advisory for a plain maritime gap while keeping other advisory detectors', () => {
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
      findingCount: 1,
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
    ])
    expect(summary.activeIssues[0]).not.toHaveProperty('debugEvidence')
  })

  it('surfaces missing critical milestone only when repeated downstream ACTUAL reinforces the gap', () => {
    const observations = [
      makeObservation({
        id: 'departure-1',
        type: 'DEPARTURE',
        location_code: 'CNSHA',
        location_display: 'Shanghai',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        created_at: '2026-04-01T10:30:00.000Z',
      }),
      makeObservation({
        id: 'discharge-1',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        created_at: '2026-04-10T10:30:00.000Z',
      }),
      makeObservation({
        id: 'discharge-2',
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        location_display: 'Rotterdam',
        event_time: temporalValueFromCanonical('2026-04-12T10:00:00.000Z'),
        created_at: '2026-04-12T10:30:00.000Z',
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
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-12T10:00:00.000Z'),
    })

    expect(summary).toMatchObject({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'ADVISORY',
      topIssue: {
        code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
        severity: 'ADVISORY',
        reasonKey: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
        affectedArea: 'timeline',
        affectedLocation: 'BRSSZ',
        affectedBlockLabelKey: null,
      },
    })
    expect(summary.activeIssues).toEqual([
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

  it('flags duplicated canonical voyage segments when the same rendered leg appears twice', () => {
    const observations = [
      makeObservation({
        id: 'load-legacy',
        type: 'LOAD',
        location_code: null,
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-14T04:10:00.000Z'),
        created_at: '2026-03-14T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-legacy',
        type: 'DISCHARGE',
        location_code: null,
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-03-20T10:00:00.000Z'),
        created_at: '2026-03-20T10:15:00.000Z',
      }),
      makeObservation({
        id: 'load-coded',
        type: 'LOAD',
        location_code: 'CNTAO',
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-21T04:10:00.000Z'),
        created_at: '2026-03-21T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-coded',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-23T19:00:00.000Z'),
        created_at: '2026-04-23T19:15:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'PCIU8712104',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'PCIU8712104',
        observations,
        derived_at: '2026-04-24T10:00:00.000Z',
        holes: [],
      },
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-24T10:00:00.000Z'),
    })

    expect(summary).toMatchObject({
      hasIssues: true,
      findingCount: 1,
      highestSeverity: 'CRITICAL',
      topIssue: {
        code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
        affectedArea: 'timeline',
        affectedLocation: 'QINGDAO',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
      },
    })
    expect(summary.activeIssues).toEqual([
      {
        code: 'CANONICAL_TIMELINE_SEGMENT_DUPLICATED',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.canonicalTimelineSegmentDuplicated',
        affectedArea: 'timeline',
        affectedLocation: 'QINGDAO',
        affectedBlockLabelKey: 'shipmentView.timeline.blocks.voyage',
      },
    ])
  })

  it('does not flag duplicated segments when the repeated vessel belongs to a different voyage', () => {
    const observations = [
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        location_code: null,
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-14T04:10:00.000Z'),
        created_at: '2026-03-14T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-1',
        type: 'DISCHARGE',
        location_code: null,
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-03-20T10:00:00.000Z'),
        created_at: '2026-03-20T10:15:00.000Z',
      }),
      makeObservation({
        id: 'load-2',
        type: 'LOAD',
        location_code: 'CNTAO',
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0002W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-21T04:10:00.000Z'),
        created_at: '2026-03-21T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-2',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0002W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-23T19:00:00.000Z'),
        created_at: '2026-04-23T19:15:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'PCIU8712104',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'PCIU8712104',
        observations,
        derived_at: '2026-04-24T10:00:00.000Z',
        holes: [],
      },
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-24T10:00:00.000Z'),
    })

    expect(summary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })

  it('does not flag duplicated segments when the same voyage identity points to a different origin', () => {
    const observations = [
      makeObservation({
        id: 'load-qingdao',
        type: 'LOAD',
        location_code: 'CNTAO',
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-14T04:10:00.000Z'),
        created_at: '2026-03-14T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-qingdao',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-03-20T10:00:00.000Z'),
        created_at: '2026-03-20T10:15:00.000Z',
      }),
      makeObservation({
        id: 'load-ningbo',
        type: 'LOAD',
        location_code: 'CNNGB',
        location_display: 'NINGBO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-21T04:10:00.000Z'),
        created_at: '2026-03-21T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-ningbo',
        type: 'DISCHARGE',
        location_code: null,
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-23T19:00:00.000Z'),
        created_at: '2026-04-23T19:15:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'PCIU8712104',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'PCIU8712104',
        observations,
        derived_at: '2026-04-24T10:00:00.000Z',
        holes: [],
      },
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-24T10:00:00.000Z'),
    })

    expect(summary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })

  it('does not flag expected updates that stay inside a single voyage block', () => {
    const observations = [
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        location_code: 'CNTAO',
        location_display: 'QINGDAO',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'ACTUAL',
        event_time: temporalValueFromCanonical('2026-03-14T04:10:00.000Z'),
        created_at: '2026-03-14T04:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-older',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-03-20T10:00:00.000Z'),
        created_at: '2026-03-20T10:15:00.000Z',
      }),
      makeObservation({
        id: 'discharge-newer',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'SANTOS',
        vessel_name: 'CMA CGM KRYPTON',
        voyage: 'VCGK0001W',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-23T19:00:00.000Z'),
        created_at: '2026-04-23T19:15:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'PCIU8712104',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'PCIU8712104',
        observations,
        derived_at: '2026-04-24T10:00:00.000Z',
        holes: [],
      },
      status: 'IN_TRANSIT',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      now: Instant.fromIso('2026-04-24T10:00:00.000Z'),
    })

    expect(summary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })
})
