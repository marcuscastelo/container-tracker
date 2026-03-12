import { describe, expect, it } from 'vitest'
import {
  assertNoObservationSemanticViolations,
  collectObservationSemanticViolations,
} from '~/modules/tracking/infrastructure/carriers/tests/helpers/observationSemanticAudit'

describe('observation semantic audit helpers', () => {
  it('detects invalid vessel placeholders', () => {
    const violations = collectObservationSemanticViolations([
      {
        type: 'LOAD',
        carrier_label: 'Export Loaded on Vessel',
        vessel_name: 'LADEN',
      },
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]?.code).toBe('invalid_vessel_name')
  })

  it('detects ARRIVAL misclassification for positioned labels', () => {
    const violations = collectObservationSemanticViolations([
      {
        type: 'ARRIVAL',
        carrier_label: 'Full Transshipment Positioned In',
        vessel_name: null,
      },
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]?.code).toBe('positioned_arrival_misclassification')
  })

  it('passes for semantically clean observations', () => {
    const clean = [
      {
        type: 'TERMINAL_MOVE' as const,
        carrier_label: 'Full Transshipment Positioned In',
        vessel_name: null,
      },
      {
        type: 'LOAD' as const,
        carrier_label: 'Full Transshipment Loaded',
        vessel_name: 'MSC BIANCA SILVIA',
      },
    ]

    expect(() => assertNoObservationSemanticViolations(clean)).not.toThrow()
  })
})
