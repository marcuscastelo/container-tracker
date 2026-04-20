import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { expectedPlanNotReconcilableDetector } from '~/modules/tracking/features/validation/domain/detectors/expectedPlanNotReconcilable.detector'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: overrides.id ?? 'observation-1',
    fingerprint: overrides.fingerprint ?? `fingerprint-${overrides.id ?? 'observation-1'}`,
    container_id: overrides.container_id ?? 'container-1',
    container_number: overrides.container_number ?? 'MSCU1234567',
    type: overrides.type ?? 'ARRIVAL',
    event_time: overrides.event_time ?? temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? 'BRSSZ',
    location_display: overrides.location_display ?? 'Santos',
    vessel_name: overrides.vessel_name ?? 'MSC VICTORY',
    voyage: overrides.voyage ?? '001W',
    is_empty: overrides.is_empty ?? false,
    confidence: overrides.confidence ?? 'high',
    provider: overrides.provider ?? 'msc',
    created_from_snapshot_id: overrides.created_from_snapshot_id ?? 'snapshot-1',
    created_at: overrides.created_at ?? '2026-04-03T10:30:00.000Z',
    retroactive: overrides.retroactive ?? false,
    carrier_label: overrides.carrier_label ?? 'Arrived',
    raw_event_time: overrides.raw_event_time ?? '2026-04-03T10:00:00.000Z',
    event_time_source: overrides.event_time_source ?? 'derived_fallback',
  }
}

function makeContext(observations: readonly Observation[]): TrackingValidationContext {
  return {
    containerId: 'container-1',
    containerNumber: 'MSCU1234567',
    observations,
    timeline: {
      container_id: 'container-1',
      container_number: 'MSCU1234567',
      observations,
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
  }
}

describe('expectedPlanNotReconcilableDetector', () => {
  it('does not emit a finding for multiple EXPECTED updates before ACTUAL confirmation', () => {
    const findings = expectedPlanNotReconcilableDetector.detect(
      makeContext([
        makeObservation({
          id: 'arrival-expected-1',
          event_time_type: 'EXPECTED',
          event_time: temporalValueFromCanonical('2026-04-04T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
        }),
        makeObservation({
          id: 'arrival-expected-2',
          event_time_type: 'EXPECTED',
          event_time: temporalValueFromCanonical('2026-04-05T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('returns an inactive ADVISORY finding when an EXPECTED remains redundant after ACTUAL in the same series', () => {
    const findings = expectedPlanNotReconcilableDetector.detect(
      makeContext([
        makeObservation({
          id: 'arrival-actual',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
        makeObservation({
          id: 'arrival-expected-late',
          event_time_type: 'EXPECTED',
          event_time: temporalValueFromCanonical('2026-04-04T10:00:00.000Z'),
          created_at: '2026-04-04T10:30:00.000Z',
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'EXPECTED_PLAN_NOT_RECONCILABLE',
      detectorVersion: '1',
      code: 'EXPECTED_PLAN_NOT_RECONCILABLE',
      severity: 'ADVISORY',
      affectedScope: 'SERIES',
      summaryKey: 'tracking.validation.expectedPlanNotReconcilable',
      affectedLocation: 'BRSSZ',
      affectedBlockLabelKey: null,
      isActive: false,
      debugEvidence: {
        locationCode: 'BRSSZ',
        primaryObservationId: 'arrival-actual',
        redundantExpectedCount: 1,
        redundantExpectedObservationIds: 'arrival-expected-late',
        seriesType: 'ARRIVAL',
      },
    })
  })

  it('does not emit a finding when the later EXPECTED belongs to a new series', () => {
    const findings = expectedPlanNotReconcilableDetector.detect(
      makeContext([
        makeObservation({
          id: 'arrival-actual',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
          vessel_name: 'MSC VICTORY',
          voyage: '001W',
        }),
        makeObservation({
          id: 'arrival-expected-new-plan',
          event_time_type: 'EXPECTED',
          event_time: temporalValueFromCanonical('2026-04-05T10:00:00.000Z'),
          created_at: '2026-04-04T10:30:00.000Z',
          vessel_name: 'MSC RESUME',
          voyage: '777E',
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('does not emit a finding for redundant EXPECTED outside the conservative allowlist', () => {
    const findings = expectedPlanNotReconcilableDetector.detect(
      makeContext([
        makeObservation({
          id: 'terminal-move-actual',
          type: 'TERMINAL_MOVE',
          carrier_label: 'Positioned in',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
        makeObservation({
          id: 'terminal-move-expected',
          type: 'TERMINAL_MOVE',
          carrier_label: 'Positioned in',
          event_time_type: 'EXPECTED',
          event_time: temporalValueFromCanonical('2026-04-04T10:00:00.000Z'),
          created_at: '2026-04-04T10:30:00.000Z',
        }),
      ]),
    )

    expect(findings).toEqual([])
  })
})
