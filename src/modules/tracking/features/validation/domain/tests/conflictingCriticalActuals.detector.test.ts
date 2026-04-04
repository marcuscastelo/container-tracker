import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { conflictingCriticalActualsDetector } from '~/modules/tracking/features/validation/domain/detectors/conflictingCriticalActuals.detector'
import {
  createEmptyTrackingValidationDetectorSignals,
  type TrackingValidationContext,
} from '~/modules/tracking/features/validation/domain/model/trackingValidationContext'
import { Instant } from '~/shared/time/instant'
import { temporalValueFromCanonical } from '~/shared/time/tests/helpers'

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: overrides.id ?? 'observation-1',
    fingerprint: overrides.fingerprint ?? 'fingerprint-1',
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
    status: 'DISCHARGED',
    transshipment: {
      hasTransshipment: false,
      transshipmentCount: 0,
      ports: [],
    },
    derivedSignals: createEmptyTrackingValidationDetectorSignals(),
    now: Instant.fromIso('2026-04-03T12:00:00.000Z'),
  }
}

describe('conflictingCriticalActualsDetector', () => {
  it('does not emit finding for a single ACTUAL in the series', () => {
    const findings = conflictingCriticalActualsDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('emits one CRITICAL finding for conflicting ACTUALs in the same critical series', () => {
    const findings = conflictingCriticalActualsDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
        makeObservation({
          id: 'discharge-2',
          event_time: temporalValueFromCanonical('2026-04-03T15:00:00.000Z'),
          created_at: '2026-04-03T15:10:00.000Z',
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'CONFLICTING_CRITICAL_ACTUALS',
      detectorVersion: '1',
      code: 'CONFLICTING_CRITICAL_ACTUALS',
      severity: 'CRITICAL',
      affectedScope: 'SERIES',
      summaryKey: 'tracking.validation.conflictingCriticalActuals',
      affectedLocation: 'BRSSZ',
      affectedBlockLabelKey: null,
      isActive: true,
      debugEvidence: {
        conflictingActualCount: 1,
        locationCode: 'BRSSZ',
        primaryObservationId: 'discharge-2',
        seriesType: 'DISCHARGE',
      },
    })
  })

  it('does not emit finding when the ACTUAL conflict is outside the critical milestone allowlist', () => {
    const findings = conflictingCriticalActualsDetector.detect(
      makeContext([
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
        makeObservation({
          id: 'load-2',
          type: 'LOAD',
          event_time: temporalValueFromCanonical('2026-04-03T15:00:00.000Z'),
          created_at: '2026-04-03T15:10:00.000Z',
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('emits one finding per conflicting critical series, not per observation', () => {
    const findings = conflictingCriticalActualsDetector.detect(
      makeContext([
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          event_time: temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
          created_at: '2026-04-03T10:30:00.000Z',
        }),
        makeObservation({
          id: 'discharge-2',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          event_time: temporalValueFromCanonical('2026-04-03T11:00:00.000Z'),
          created_at: '2026-04-03T11:10:00.000Z',
        }),
        makeObservation({
          id: 'delivery-1',
          type: 'DELIVERY',
          location_code: 'BRSSZ',
          vessel_name: null,
          voyage: null,
          event_time: temporalValueFromCanonical('2026-04-05'),
          created_at: '2026-04-05T09:00:00.000Z',
        }),
        makeObservation({
          id: 'delivery-2',
          type: 'DELIVERY',
          location_code: 'BRSSZ',
          vessel_name: null,
          voyage: null,
          event_time: temporalValueFromCanonical('2026-04-06'),
          created_at: '2026-04-06T09:00:00.000Z',
        }),
      ]),
    )

    expect(findings).toHaveLength(2)
    expect(findings.map((finding) => finding.debugEvidence?.seriesType)).toEqual([
      'DISCHARGE',
      'DELIVERY',
    ])
    expect(findings.map((finding) => finding.affectedLocation)).toEqual(['BRSSZ', 'BRSSZ'])
    expect(findings.map((finding) => finding.affectedBlockLabelKey)).toEqual([null, null])
  })
})
