import { expect } from 'vitest'
import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'

type ObservationSemanticAuditInput = Pick<
  ObservationDraft,
  'type' | 'carrier_label' | 'vessel_name'
>

type ObservationSemanticViolation = {
  readonly code: 'invalid_vessel_name' | 'positioned_arrival_misclassification'
  readonly type: ObservationDraft['type']
  readonly carrier_label: string | null
  readonly vessel_name: string | null
}

const INVALID_VESSEL_NAMES = new Set(['LADEN', 'EMPTY', 'TBN'])

function isPositionedLabel(label: string | null): boolean {
  if (typeof label !== 'string') return false
  return label.toLowerCase().includes('positioned')
}

export function collectObservationSemanticViolations(
  observations: readonly ObservationSemanticAuditInput[],
): ObservationSemanticViolation[] {
  const violations: ObservationSemanticViolation[] = []

  for (const observation of observations) {
    const carrierLabel = observation.carrier_label ?? null
    const vesselName = observation.vessel_name ?? null
    const normalizedVesselName =
      typeof vesselName === 'string' ? vesselName.trim().toUpperCase() : null

    if (
      typeof normalizedVesselName === 'string' &&
      INVALID_VESSEL_NAMES.has(normalizedVesselName)
    ) {
      violations.push({
        code: 'invalid_vessel_name',
        type: observation.type,
        carrier_label: carrierLabel,
        vessel_name: vesselName,
      })
    }

    if (observation.type === 'ARRIVAL' && isPositionedLabel(carrierLabel)) {
      violations.push({
        code: 'positioned_arrival_misclassification',
        type: observation.type,
        carrier_label: carrierLabel,
        vessel_name: vesselName,
      })
    }
  }

  return violations
}

export function assertNoObservationSemanticViolations(
  observations: readonly ObservationSemanticAuditInput[],
): void {
  expect(collectObservationSemanticViolations(observations)).toEqual([])
}
