import { describe, expect, it } from 'vitest'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import { missingCriticalMilestoneWithContradictoryContextDetector } from '~/modules/tracking/features/validation/domain/detectors/missingCriticalMilestoneWithContradictoryContext.detector'
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
    type: overrides.type ?? 'LOAD',
    event_time: overrides.event_time ?? temporalValueFromCanonical('2026-04-03T10:00:00.000Z'),
    event_time_type: overrides.event_time_type ?? 'ACTUAL',
    location_code: overrides.location_code ?? 'CNSHA',
    location_display: overrides.location_display ?? 'Shanghai',
    vessel_name: overrides.vessel_name ?? 'MSC VICTORY',
    voyage: overrides.voyage ?? '001W',
    is_empty: overrides.is_empty ?? false,
    confidence: overrides.confidence ?? 'high',
    provider: overrides.provider ?? 'msc',
    created_from_snapshot_id: overrides.created_from_snapshot_id ?? 'snapshot-1',
    created_at: overrides.created_at ?? '2026-04-03T10:30:00.000Z',
    retroactive: overrides.retroactive ?? false,
    carrier_label: overrides.carrier_label ?? 'Loaded',
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

describe('missingCriticalMilestoneWithContradictoryContextDetector', () => {
  it('does not emit a finding when the ACTUAL maritime sequence is complete', () => {
    const findings = missingCriticalMilestoneWithContradictoryContextDetector.detect(
      makeContext([
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          created_at: '2026-04-01T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'departure-1',
          type: 'DEPARTURE',
          location_code: 'CNSHA',
          location_display: 'Shanghai',
          created_at: '2026-04-02T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'arrival-1',
          type: 'ARRIVAL',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          created_at: '2026-04-10T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          created_at: '2026-04-11T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-11T10:00:00.000Z'),
        }),
      ]),
    )

    expect(findings).toEqual([])
  })

  it('emits one ADVISORY finding for missing DEPARTURE when ARRIVAL appears after LOAD', () => {
    const findings = missingCriticalMilestoneWithContradictoryContextDetector.detect(
      makeContext([
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          created_at: '2026-04-01T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'arrival-1',
          type: 'ARRIVAL',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          created_at: '2026-04-10T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          created_at: '2026-04-11T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-11T10:00:00.000Z'),
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      detectorId: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
      detectorVersion: '1',
      code: 'MISSING_CRITICAL_MILESTONE_WITH_CONTRADICTORY_CONTEXT',
      severity: 'ADVISORY',
      affectedScope: 'TIMELINE',
      summaryKey: 'tracking.validation.missingCriticalMilestoneWithContradictoryContext',
      affectedLocation: 'BRSSZ',
      affectedBlockLabelKey: null,
      isActive: true,
      debugEvidence: {
        anchorObservationId: 'arrival-1',
        anchorObservationType: 'ARRIVAL',
        locationCode: 'BRSSZ',
        missingMilestone: 'DEPARTURE',
        previousObservationId: 'load-1',
        previousObservationType: 'LOAD',
      },
    })
  })

  it('emits one ADVISORY finding for missing ARRIVAL when DISCHARGE appears after DEPARTURE', () => {
    const findings = missingCriticalMilestoneWithContradictoryContextDetector.detect(
      makeContext([
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          created_at: '2026-04-01T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'departure-1',
          type: 'DEPARTURE',
          location_code: 'CNSHA',
          location_display: 'Shanghai',
          created_at: '2026-04-02T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'discharge-1',
          type: 'DISCHARGE',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          created_at: '2026-04-10T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        }),
      ]),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]?.debugEvidence).toMatchObject({
      missingMilestone: 'ARRIVAL',
      previousObservationType: 'DEPARTURE',
      anchorObservationType: 'DISCHARGE',
    })
    expect(findings[0]?.affectedLocation).toBe('BRSSZ')
  })

  it('does not emit a finding from EXPECTED-only contradictory context', () => {
    const findings = missingCriticalMilestoneWithContradictoryContextDetector.detect(
      makeContext([
        makeObservation({
          id: 'load-1',
          type: 'LOAD',
          created_at: '2026-04-01T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
        }),
        makeObservation({
          id: 'arrival-expected-1',
          type: 'ARRIVAL',
          location_code: 'BRSSZ',
          location_display: 'Santos',
          event_time_type: 'EXPECTED',
          created_at: '2026-04-10T10:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
        }),
      ]),
    )

    expect(findings).toEqual([])
  })
})
