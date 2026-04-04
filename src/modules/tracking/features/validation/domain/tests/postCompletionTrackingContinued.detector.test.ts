import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { postCompletionTrackingContinuedDetector } from '~/modules/tracking/features/validation/domain/detectors/postCompletionTrackingContinued.detector'
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
    type: overrides.type ?? 'DISCHARGE',
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
    carrier_label: overrides.carrier_label ?? 'Discharged',
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
    status: 'DELIVERED',
    transshipment: {
      hasTransshipment: false,
      transshipmentCount: 0,
      ports: [],
    },
    derivedSignals: createEmptyTrackingValidationDetectorSignals(),
    now: Instant.fromIso('2026-04-03T12:00:00.000Z'),
  }
}

describe('postCompletionTrackingContinuedDetector', () => {
  it('does not emit a finding when delivered tracking has no incompatible continuation', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'delivery-1',
          type: 'DELIVERY',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('does not emit a finding when empty return has no incompatible continuation', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'delivery-1',
          type: 'DELIVERY',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
        }),
        makeObservation({
          id: 'empty-return-1',
          type: 'EMPTY_RETURN',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
          is_empty: true,
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('emits a CRITICAL finding when an incompatible EXPECTED journey signal appears after delivery', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'delivery-1',
          type: 'DELIVERY',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
        }),
        makeObservation({
          id: 'arrival-expected-1',
          type: 'ARRIVAL',
          event_time: temporalValueFromCanonical('2026-04-04T10:00:00.000Z'),
          event_time_type: 'EXPECTED',
          created_at: '2026-04-04T10:30:00.000Z',
          location_code: 'USLAX',
          location_display: 'Los Angeles',
          vessel_name: 'MSC RESUME',
          voyage: '777E',
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'POST_COMPLETION_TRACKING_CONTINUED',
      detectorVersion: '1',
      code: 'POST_COMPLETION_TRACKING_CONTINUED',
      severity: 'CRITICAL',
      affectedScope: 'TIMELINE',
      summaryKey: 'tracking.validation.postCompletionTrackingContinued',
      isActive: true,
      debugEvidence: {
        completionObservationId: 'delivery-1',
        completionSource: 'DELIVERY',
        completionStatus: 'DELIVERED',
        continuationEventTimeType: 'EXPECTED',
        continuationObservationId: 'arrival-expected-1',
        continuationType: 'ARRIVAL',
      },
    })
  })

  it('emits a CRITICAL finding when load resumes after empty return', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'empty-return-1',
          type: 'EMPTY_RETURN',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
          is_empty: true,
        }),
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          event_time: temporalValueFromCanonical('2026-04-05T10:00:00.000Z'),
          created_at: '2026-04-05T10:30:00.000Z',
          location_code: 'ITNAP',
          location_display: 'Naples',
          vessel_name: 'MSC RESUME',
          voyage: '777E',
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.debugEvidence).toMatchObject({
      completionStatus: 'EMPTY_RETURNED',
      continuationType: 'LOAD',
    })
  })

  it('does not emit a finding for the legitimate delivered to empty-return continuation', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'delivery-1',
          type: 'DELIVERY',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
          created_at: '2026-04-01T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
        }),
        makeObservation({
          id: 'empty-return-1',
          type: 'EMPTY_RETURN',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
          is_empty: true,
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('uses delivery gate-out fallback as a strong completion anchor', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
          created_at: '2026-04-01T10:30:00.000Z',
        }),
        makeObservation({
          id: 'delivery-gate-out-1',
          type: 'GATE_OUT',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
          is_empty: false,
        }),
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
          location_code: 'ITNAP',
          location_display: 'Naples',
          vessel_name: 'MSC RESUME',
          voyage: '777E',
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.debugEvidence).toMatchObject({
      completionSource: 'DELIVERY_GATE_OUT',
      completionStatus: 'DELIVERED',
      continuationType: 'LOAD',
    })
  })

  it('uses empty-return gate-out fallback as a strong completion anchor', () => {
    const findings = postCompletionTrackingContinuedDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
          created_at: '2026-04-01T10:30:00.000Z',
        }),
        makeObservation({
          id: 'empty-gate-out-1',
          type: 'GATE_OUT',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
          created_at: '2026-04-02T10:30:00.000Z',
          location_code: 'BRIOA',
          location_display: 'Itapoa',
          vessel_name: null,
          voyage: null,
          is_empty: true,
        }),
        makeObservation({
          id: 'gate-in-1',
          type: 'GATE_IN',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
          location_code: 'ITNAP',
          location_display: 'Naples',
          vessel_name: null,
          voyage: null,
          is_empty: false,
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.debugEvidence).toMatchObject({
      completionSource: 'EMPTY_RETURN_GATE_OUT',
      completionStatus: 'EMPTY_RETURNED',
      continuationType: 'GATE_IN',
    })
  })
})
