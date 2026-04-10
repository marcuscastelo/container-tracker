import { describe, expect, it } from 'vitest'
import { deriveTransshipment } from '~/modules/tracking/features/alerts/domain/derive/deriveAlerts'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { deriveTimeline } from '~/modules/tracking/features/timeline/domain/derive/deriveTimeline'
import {
  createTrackingValidationContext,
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

type SameDayValidationTieEventKey = 'load' | 'positionedIn' | 'positionedOut'

function makeSameDayTransshipmentValidationObservations(
  sameDayOrder: readonly SameDayValidationTieEventKey[],
): readonly Observation[] {
  const sameDayCreatedAt = '2026-04-04T16:08:29.699745+00'
  const sameDayEvents: Record<SameDayValidationTieEventKey, Observation> = {
    load: makeObservation({
      id: 'same-day-load',
      type: 'LOAD',
      created_at: sameDayCreatedAt,
      event_time: temporalValueFromCanonical('2026-02-28'),
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      vessel_name: 'MSC BIANCA SILVIA',
      voyage: 'UX605A',
    }),
    positionedIn: makeObservation({
      id: 'same-day-positioned-in',
      type: 'TRANSSHIPMENT_POSITIONED_IN',
      created_at: sameDayCreatedAt,
      event_time: temporalValueFromCanonical('2026-02-28'),
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      vessel_name: null,
      voyage: null,
    }),
    positionedOut: makeObservation({
      id: 'same-day-positioned-out',
      type: 'TRANSSHIPMENT_POSITIONED_OUT',
      created_at: sameDayCreatedAt,
      event_time: temporalValueFromCanonical('2026-02-28'),
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      vessel_name: null,
      voyage: null,
    }),
  }

  return [
    makeObservation({
      id: 'pre-gate-out',
      type: 'GATE_OUT',
      created_at: '2026-04-04T16:08:29.699745+00',
      event_time: temporalValueFromCanonical('2025-11-30'),
      location_code: 'PKLYP',
      location_display: 'FAISALABAD, PK',
      vessel_name: null,
      voyage: null,
      is_empty: true,
    }),
    makeObservation({
      id: 'pre-gate-in',
      type: 'GATE_IN',
      created_at: '2026-04-04T16:08:29.699745+00',
      event_time: temporalValueFromCanonical('2025-12-30'),
      location_code: 'PKKHI',
      location_display: 'KARACHI, PK',
      vessel_name: null,
      voyage: null,
      is_empty: false,
    }),
    makeObservation({
      id: 'voyage-a-load',
      type: 'LOAD',
      created_at: '2026-04-04T16:08:29.699745+00',
      event_time: temporalValueFromCanonical('2026-01-02'),
      location_code: 'PKKHI',
      location_display: 'KARACHI, PK',
      vessel_name: 'MSC IRIS',
      voyage: 'QS551R',
    }),
    makeObservation({
      id: 'voyage-a-discharge',
      type: 'DISCHARGE',
      created_at: '2026-04-04T16:08:29.699745+00',
      event_time: temporalValueFromCanonical('2026-02-10'),
      location_code: 'KRPUS',
      location_display: 'BUSAN, KR',
      vessel_name: 'MSC IRIS',
      voyage: 'UX604A',
    }),
    ...sameDayOrder.map((key) => sameDayEvents[key]),
    makeObservation({
      id: 'voyage-b-arrival-expected',
      type: 'ARRIVAL',
      created_at: '2026-04-04T16:08:29.699745+00',
      event_time_type: 'EXPECTED',
      event_time: temporalValueFromCanonical('2026-05-08'),
      location_code: 'BRSSZ',
      location_display: 'SANTOS, BR',
      vessel_name: 'MSC BIANCA SILVIA',
      voyage: 'UX614R',
    }),
  ]
}

function deriveValidationSummaryForObservations(
  observations: readonly Observation[],
  containerNumber = 'CAIU6241835',
) {
  return deriveTrackingValidationSummaryFromState({
    containerId: 'container-1',
    containerNumber,
    observations,
    timeline: {
      container_id: 'container-1',
      container_number: containerNumber,
      observations,
      derived_at: '2026-04-08T10:00:00.000Z',
      holes: [],
    },
    status: 'IN_TRANSIT',
    transshipment: {
      hasTransshipment: true,
      transshipmentCount: 1,
      ports: ['KRPUS'],
    },
    now: Instant.fromIso('2026-04-08T10:00:00.000Z'),
  })
}

function makeLegAwareSplitObservations(): readonly Observation[] {
  return [
    makeObservation({
      id: 'karachi-load-arica',
      type: 'LOAD',
      created_at: '2026-03-19T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-19T10:00:00.000Z'),
      location_code: 'PKKHI',
      location_display: 'Karachi',
      vessel_name: 'MSC ARICA',
      voyage: 'OB610R',
      carrier_label: 'Export Loaded on Vessel',
    }),
    makeObservation({
      id: 'colombo-discharge-arica',
      type: 'DISCHARGE',
      created_at: '2026-03-28T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-28T10:00:00.000Z'),
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: 'MSC ARICA',
      voyage: 'IV610A',
      carrier_label: 'Full Transshipment Discharged',
    }),
    makeObservation({
      id: 'colombo-discharge-arica-duplicate',
      type: 'DISCHARGE',
      created_at: '2026-03-28T11:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-28T10:00:00.000Z'),
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: 'MSC ARICA',
      voyage: 'OB610R',
      carrier_label: 'Full Transshipment Discharged',
    }),
    makeObservation({
      id: 'colombo-positioned-in',
      type: 'TRANSSHIPMENT_POSITIONED_IN',
      created_at: '2026-03-29T08:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-29T08:00:00.000Z'),
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: null,
      voyage: null,
      carrier_label: 'Full Transshipment Positioned In',
    }),
    makeObservation({
      id: 'colombo-positioned-out',
      type: 'TRANSSHIPMENT_POSITIONED_OUT',
      created_at: '2026-03-29T18:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-29T18:00:00.000Z'),
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: null,
      voyage: null,
      carrier_label: 'Full Transshipment Positioned Out',
    }),
    makeObservation({
      id: 'colombo-load-violetta',
      type: 'LOAD',
      created_at: '2026-03-31T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-31T10:00:00.000Z'),
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: 'GSL VIOLETTA',
      voyage: 'ZF609R',
      carrier_label: 'Full Transshipment Loaded',
    }),
    makeObservation({
      id: 'singapore-discharge-violetta',
      type: 'DISCHARGE',
      created_at: '2026-04-07T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-04-07T10:00:00.000Z'),
      location_code: 'SGSIN',
      location_display: 'Singapore',
      vessel_name: 'GSL VIOLETTA',
      voyage: 'ZF609R',
      carrier_label: 'Import Discharged from Vessel',
    }),
  ]
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
      findingCount: 1,
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
          code: 'CONFLICTING_CRITICAL_ACTUALS',
          severity: 'CRITICAL',
          reasonKey: 'tracking.validation.conflictingCriticalActuals',
          affectedArea: 'series',
          affectedLocation: 'BRIOA',
          affectedBlockLabelKey: null,
        },
      },
    ])

    expect(result).toEqual({
      code: 'CONFLICTING_CRITICAL_ACTUALS',
      severity: 'CRITICAL',
      reasonKey: 'tracking.validation.conflictingCriticalActuals',
      affectedArea: 'series',
      affectedLocation: 'BRIOA',
      affectedBlockLabelKey: null,
    })
  })

  it('reuses provided derived signals when building the validation context', () => {
    const context = createTrackingValidationContext({
      containerId: 'container-1',
      containerNumber: 'MSCU1234567',
      observations: [],
      timeline: {
        container_id: 'container-1',
        container_number: 'MSCU1234567',
        observations: [],
        derived_at: '2026-04-04T10:00:00.000Z',
        holes: [],
      },
      status: 'UNKNOWN',
      transshipment: {
        hasTransshipment: false,
        transshipmentCount: 0,
        ports: [],
      },
      derivedSignals: {
        canonicalTimeline: {
          postCarriageMaritimeEvents: [
            {
              type: 'DEPARTURE',
              eventTimeType: 'ACTUAL',
              location: 'Santos',
              hasVesselContext: true,
              hasVoyageContext: true,
            },
          ],
          duplicatedSegments: [],
        },
      },
      now: Instant.fromIso('2026-04-04T10:00:00.000Z'),
    })

    expect(context.derivedSignals).toEqual({
      canonicalTimeline: {
        postCarriageMaritimeEvents: [
          {
            type: 'DEPARTURE',
            eventTimeType: 'ACTUAL',
            location: 'Santos',
            hasVesselContext: true,
            hasVoyageContext: true,
          },
        ],
        duplicatedSegments: [],
      },
    })
  })

  it('does not surface redundant EXPECTED-after-ACTUAL residue as an active validation issue', () => {
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

    expect(summary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      topIssue: null,
      activeIssues: [],
    })
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

  it('surfaces conflicting maritime ACTUALs for a new leg without raising missing milestone', () => {
    const observations = makeLegAwareSplitObservations()

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'GLDU2928252',
      observations,
      timeline: {
        container_id: 'container-1',
        container_number: 'GLDU2928252',
        observations,
        derived_at: '2026-04-08T10:00:00.000Z',
        holes: [],
      },
      status: 'DISCHARGED',
      transshipment: {
        hasTransshipment: true,
        transshipmentCount: 1,
        ports: ['LKCMB'],
      },
      now: Instant.fromIso('2026-04-08T10:00:00.000Z'),
    })

    expect(summary.activeIssues).toEqual([
      {
        code: 'CONFLICTING_CRITICAL_ACTUALS',
        severity: 'CRITICAL',
        reasonKey: 'tracking.validation.conflictingCriticalActuals',
        affectedArea: 'series',
        affectedLocation: 'LKCMB',
        affectedBlockLabelKey: null,
      },
    ])
    expect(
      summary.activeIssues.some(
        (issue) => issue.code === 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
      ),
    ).toBe(false)
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

  it('does not emit a post-carriage advisory for planned maritime continuation', () => {
    const observations = [
      makeObservation({
        id: 'leg-a-load',
        type: 'LOAD',
        location_code: 'PKKHI',
        location_display: 'Karachi',
        vessel_name: 'MSC MIRAYA V',
        voyage: 'OB612R',
        event_time: temporalValueFromCanonical('2026-03-01T10:00:00.000Z'),
        created_at: '2026-03-01T10:30:00.000Z',
      }),
      makeObservation({
        id: 'leg-a-discharge',
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        location_display: 'Singapore',
        event_time: temporalValueFromCanonical('2026-03-11T10:00:00.000Z'),
        created_at: '2026-03-11T10:30:00.000Z',
      }),
      makeObservation({
        id: 'planned-intended',
        type: 'TRANSSHIPMENT_INTENDED',
        location_code: 'SGSIN',
        location_display: 'Singapore',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-03-12'),
        created_at: '2026-03-12T10:30:00.000Z',
      }),
      makeObservation({
        id: 'planned-arrival',
        type: 'ARRIVAL',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        event_time_type: 'EXPECTED',
        event_time: temporalValueFromCanonical('2026-04-10'),
        created_at: '2026-03-12T10:31:00.000Z',
      }),
    ] satisfies readonly Observation[]

    const timeline = deriveTimeline(
      'container-1',
      'MSCU1234567',
      observations,
      Instant.fromIso('2026-03-20T10:00:00.000Z'),
    )

    const summary = deriveTrackingValidationSummaryFromState({
      containerId: 'container-1',
      containerNumber: 'MSCU1234567',
      observations,
      timeline,
      status: 'LOADED',
      transshipment: deriveTransshipment(timeline),
      now: Instant.fromIso('2026-03-20T10:00:00.000Z'),
    })

    expect(summary.hasIssues).toBe(false)
    expect(summary.activeIssues).toEqual([])
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

  it('keeps same-day transshipment ties from surfacing canonical timeline advisories', () => {
    const badOrderSummary = deriveValidationSummaryForObservations(
      makeSameDayTransshipmentValidationObservations(['load', 'positionedIn', 'positionedOut']),
      'CAIU6241835',
    )
    const goodOrderSummary = deriveValidationSummaryForObservations(
      makeSameDayTransshipmentValidationObservations(['positionedIn', 'positionedOut', 'load']),
      'MSBU3493578',
    )

    expect(badOrderSummary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
    expect(goodOrderSummary).toEqual({
      hasIssues: false,
      findingCount: 0,
      highestSeverity: null,
      activeIssues: [],
      topIssue: null,
    })
  })
})
