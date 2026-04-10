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

function detectFindings(observations: readonly Observation[]) {
  return missingCriticalMilestoneWithContradictoryContextDetector.detect(makeContext(observations))
}

function makeSplitLegTransshipmentObservations(command?: {
  readonly includeTerminalMoves?: boolean
  readonly includeSamePortDischargeDuplicate?: boolean
}): readonly Observation[] {
  const samePortDuplicate = command?.includeSamePortDischargeDuplicate
    ? [
        makeObservation({
          id: 'colombo-discharge-arica-duplicate',
          type: 'DISCHARGE',
          location_code: 'LKCMB',
          location_display: 'Colombo',
          vessel_name: 'MSC ARICA',
          voyage: 'OB610R',
          created_at: '2026-03-28T11:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-03-28T10:00:00.000Z'),
          carrier_label: 'Full Transshipment Discharged',
        }),
      ]
    : []

  const terminalMoves = command?.includeTerminalMoves
    ? [
        makeObservation({
          id: 'colombo-positioned-in',
          type: 'TRANSSHIPMENT_POSITIONED_IN',
          location_code: 'LKCMB',
          location_display: 'Colombo',
          vessel_name: null,
          voyage: null,
          created_at: '2026-03-29T08:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-03-29T08:00:00.000Z'),
          carrier_label: 'Full Transshipment Positioned In',
        }),
        makeObservation({
          id: 'colombo-positioned-out',
          type: 'TRANSSHIPMENT_POSITIONED_OUT',
          location_code: 'LKCMB',
          location_display: 'Colombo',
          vessel_name: null,
          voyage: null,
          created_at: '2026-03-29T18:30:00.000Z',
          event_time: temporalValueFromCanonical('2026-03-29T18:00:00.000Z'),
          carrier_label: 'Full Transshipment Positioned Out',
        }),
      ]
    : []

  return [
    makeObservation({
      id: 'karachi-load-arica',
      type: 'LOAD',
      location_code: 'PKKHI',
      location_display: 'Karachi',
      vessel_name: 'MSC ARICA',
      voyage: 'OB610R',
      created_at: '2026-03-19T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-19T10:00:00.000Z'),
      carrier_label: 'Export Loaded on Vessel',
    }),
    makeObservation({
      id: 'colombo-discharge-arica',
      type: 'DISCHARGE',
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: 'MSC ARICA',
      voyage: 'IV610A',
      created_at: '2026-03-28T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-28T10:00:00.000Z'),
      carrier_label: 'Full Transshipment Discharged',
    }),
    ...samePortDuplicate,
    ...terminalMoves,
    makeObservation({
      id: 'colombo-load-violetta',
      type: 'LOAD',
      location_code: 'LKCMB',
      location_display: 'Colombo',
      vessel_name: 'GSL VIOLETTA',
      voyage: 'ZF609R',
      created_at: '2026-03-31T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-03-31T10:00:00.000Z'),
      carrier_label: 'Full Transshipment Loaded',
    }),
    makeObservation({
      id: 'singapore-discharge-violetta',
      type: 'DISCHARGE',
      location_code: 'SGSIN',
      location_display: 'Singapore',
      vessel_name: 'GSL VIOLETTA',
      voyage: 'ZF609R',
      created_at: '2026-04-07T10:30:00.000Z',
      event_time: temporalValueFromCanonical('2026-04-07T10:00:00.000Z'),
      carrier_label: 'Import Discharged from Vessel',
    }),
  ]
}

describe('missingCriticalMilestoneWithContradictoryContextDetector', () => {
  it('does not emit a finding when the ACTUAL maritime sequence is complete', () => {
    const findings = detectFindings([
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
    ])

    expect(findings).toEqual([])
  })

  it('does not emit when a new LOAD ACTUAL opens a distinct maritime leg', () => {
    const findings = detectFindings(makeSplitLegTransshipmentObservations())

    expect(findings).toEqual([])
  })

  it('does not emit when same-port transshipment helper events sit between maritime legs', () => {
    const findings = detectFindings(
      makeSplitLegTransshipmentObservations({ includeTerminalMoves: true }),
    )

    expect(findings).toEqual([])
  })

  it('does not emit for the Colombo transshipment case when the same discharge is duplicated at the same port', () => {
    const findings = detectFindings(
      makeSplitLegTransshipmentObservations({
        includeSamePortDischargeDuplicate: true,
        includeTerminalMoves: true,
      }),
    )

    expect(findings).toEqual([])
  })

  it('does not emit for a plain LOAD -> DISCHARGE gap', () => {
    const findings = detectFindings([
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        created_at: '2026-04-01T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-1',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        created_at: '2026-04-10T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
      }),
    ])

    expect(findings).toEqual([])
  })

  it('emits one ADVISORY finding when DISCHARGE repeats inside the same leg after a missing DEPARTURE', () => {
    const findings = detectFindings([
      makeObservation({
        id: 'load-1',
        fingerprint: 'load-1',
        type: 'LOAD',
        location_code: 'PKKHI',
        location_display: 'Karachi',
        vessel_name: 'MSC ARICA',
        voyage: 'OB610R',
        created_at: '2026-03-19T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-03-19T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-1',
        fingerprint: 'discharge-1',
        type: 'DISCHARGE',
        location_code: 'LKCMB',
        location_display: 'Colombo',
        vessel_name: 'MSC ARICA',
        voyage: 'IV610A',
        created_at: '2026-03-28T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-03-28T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-2',
        fingerprint: 'discharge-2',
        type: 'DISCHARGE',
        location_code: 'SGSIN',
        location_display: 'Singapore',
        vessel_name: 'MSC ARICA',
        voyage: 'IV610A',
        created_at: '2026-04-07T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-07T10:00:00.000Z'),
      }),
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      affectedLocation: 'LKCMB',
      debugEvidence: {
        anchorObservationId: 'discharge-1',
        anchorObservationType: 'DISCHARGE',
        missingMilestone: 'DEPARTURE',
        previousObservationId: 'load-1',
        previousObservationType: 'LOAD',
      },
    })
  })

  it('does not emit for a plain DEPARTURE -> DISCHARGE gap', () => {
    const findings = detectFindings([
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
    ])

    expect(findings).toEqual([])
  })

  it('does not emit for LOAD -> ARRIVAL -> DISCHARGE when the only issue is the missing DEPARTURE', () => {
    const findings = detectFindings([
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
    ])

    expect(findings).toEqual([])
  })

  it('does not emit for a plausible transshipment flow with a missing ARRIVAL milestone', () => {
    const findings = detectFindings([
      makeObservation({
        id: 'load-1',
        type: 'LOAD',
        location_code: 'CNSHA',
        location_display: 'Shanghai',
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
        location_code: 'MAPTM',
        location_display: 'Tangier',
        created_at: '2026-04-10T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'load-2',
        type: 'LOAD',
        location_code: 'MAPTM',
        location_display: 'Tangier',
        vessel_name: 'MSC LEON',
        voyage: '614S',
        created_at: '2026-04-11T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-11T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'departure-2',
        type: 'DEPARTURE',
        location_code: 'MAPTM',
        location_display: 'Tangier',
        vessel_name: 'MSC LEON',
        voyage: '614S',
        created_at: '2026-04-12T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-12T10:00:00.000Z'),
      }),
    ])

    expect(findings).toEqual([])
  })

  it('emits one ADVISORY finding when DISCHARGE repeats after a missing ARRIVAL gap', () => {
    const findings = detectFindings([
      makeObservation({
        id: 'departure-1',
        fingerprint: 'departure-1',
        type: 'DEPARTURE',
        location_code: 'CNSHA',
        location_display: 'Shanghai',
        created_at: '2026-04-02T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-1',
        fingerprint: 'discharge-1',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        created_at: '2026-04-10T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-2',
        fingerprint: 'discharge-2',
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        location_display: 'Rotterdam',
        created_at: '2026-04-12T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-12T10:00:00.000Z'),
      }),
    ])

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
        anchorObservationId: 'discharge-1',
        anchorObservationType: 'DISCHARGE',
        locationCode: 'BRSSZ',
        missingMilestone: 'ARRIVAL',
        previousObservationId: 'departure-1',
        previousObservationType: 'DEPARTURE',
      },
    })
  })

  it('emits one ADVISORY finding when ARRIVAL repeats after a missing DEPARTURE gap', () => {
    const findings = detectFindings([
      makeObservation({
        id: 'load-1',
        fingerprint: 'load-1',
        type: 'LOAD',
        location_code: 'CNSHA',
        location_display: 'Shanghai',
        created_at: '2026-04-01T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-01T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'arrival-1',
        fingerprint: 'arrival-1',
        type: 'ARRIVAL',
        location_code: 'MAPTM',
        location_display: 'Tangier',
        created_at: '2026-04-10T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'arrival-2',
        fingerprint: 'arrival-2',
        type: 'ARRIVAL',
        location_code: 'ESALG',
        location_display: 'Algeciras',
        created_at: '2026-04-12T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-12T10:00:00.000Z'),
      }),
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0]?.debugEvidence).toMatchObject({
      missingMilestone: 'DEPARTURE',
      previousObservationType: 'LOAD',
      anchorObservationType: 'ARRIVAL',
    })
    expect(findings[0]?.affectedLocation).toBe('MAPTM')
  })

  it('does not emit a finding from EXPECTED-only contradictory context', () => {
    const findings = detectFindings([
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
    ])

    expect(findings).toEqual([])
  })

  it('keeps lifecycleKey and stateFingerprint stable for the same contradictory input', () => {
    const observations = [
      makeObservation({
        id: 'departure-1',
        fingerprint: 'departure-1',
        type: 'DEPARTURE',
        created_at: '2026-04-02T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-02T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-1',
        fingerprint: 'discharge-1',
        type: 'DISCHARGE',
        location_code: 'BRSSZ',
        location_display: 'Santos',
        created_at: '2026-04-10T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-10T10:00:00.000Z'),
      }),
      makeObservation({
        id: 'discharge-2',
        fingerprint: 'discharge-2',
        type: 'DISCHARGE',
        location_code: 'NLRTM',
        location_display: 'Rotterdam',
        created_at: '2026-04-12T10:30:00.000Z',
        event_time: temporalValueFromCanonical('2026-04-12T10:00:00.000Z'),
      }),
    ] satisfies readonly Observation[]

    const firstFindings = detectFindings(observations)
    const secondFindings = detectFindings(observations)

    expect(firstFindings).toHaveLength(1)
    expect(secondFindings).toHaveLength(1)
    expect(firstFindings[0]?.lifecycleKey).toBe(secondFindings[0]?.lifecycleKey)
    expect(firstFindings[0]?.stateFingerprint).toBe(secondFindings[0]?.stateFingerprint)
  })
})
