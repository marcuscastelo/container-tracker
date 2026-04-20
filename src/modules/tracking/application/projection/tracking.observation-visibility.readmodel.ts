import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'

function normalizeText(value: string | null | undefined): string {
  return (
    value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLowerCase() ?? ''
  )
}

function normalizeCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? ''
}

function temporalIdentity(observation: Observation): string {
  if (observation.event_time === null) return `null-time:${observation.fingerprint}`
  if (observation.event_time.kind === 'instant') {
    return `instant:${observation.event_time.value.toIsoString()}`
  }
  if (observation.event_time.kind === 'local-datetime') {
    return `local-datetime:${observation.event_time.value.toCanonicalString()}`
  }
  return `date:${observation.event_time.value.toIsoDate()}`
}

function buildObservationIdentity(observation: Observation, mode: 'strict' | 'fallback'): string {
  const parts = [
    observation.provider,
    normalizeText(observation.carrier_label ?? null),
    temporalIdentity(observation),
    normalizeCode(observation.location_code),
    normalizeText(observation.location_display),
    normalizeCode(observation.vessel_name),
    normalizeCode(observation.voyage),
  ]

  if (mode === 'strict') {
    parts.splice(1, 0, observation.created_from_snapshot_id)
  }

  return parts.join('|')
}

function buildObservationIdentityVariants(observation: Observation): readonly string[] {
  return [
    buildObservationIdentity(observation, 'strict'),
    buildObservationIdentity(observation, 'fallback'),
  ]
}

const POSITIONED_LABEL_TO_TYPE: Readonly<Record<string, ObservationType>> = {
  'full transshipment positioned in': 'TRANSSHIPMENT_POSITIONED_IN',
  'full transshipment positioned out': 'TRANSSHIPMENT_POSITIONED_OUT',
}

function expectedMappedTypeForLegacyTerminalMove(observation: Observation): ObservationType | null {
  if (observation.type !== 'TERMINAL_MOVE') return null
  const normalizedCarrierLabel = normalizeText(observation.carrier_label ?? null)
  return POSITIONED_LABEL_TO_TYPE[normalizedCarrierLabel] ?? null
}

export function suppressSupersededObservationsForProjection(
  observations: readonly Observation[],
): readonly Observation[] {
  if (observations.length === 0) return observations

  const richerIdentityKeys = new Set<string>()
  const positionedInIdentityKeys = new Set<string>()
  const positionedOutIdentityKeys = new Set<string>()

  for (const observation of observations) {
    if (observation.type !== 'OTHER') {
      for (const key of buildObservationIdentityVariants(observation)) {
        richerIdentityKeys.add(key)
      }
    }

    if (observation.type === 'TRANSSHIPMENT_POSITIONED_IN') {
      for (const key of buildObservationIdentityVariants(observation)) {
        positionedInIdentityKeys.add(key)
      }
    }

    if (observation.type === 'TRANSSHIPMENT_POSITIONED_OUT') {
      for (const key of buildObservationIdentityVariants(observation)) {
        positionedOutIdentityKeys.add(key)
      }
    }
  }

  return observations.filter((observation) => {
    if (observation.type === 'OTHER') {
      return !buildObservationIdentityVariants(observation).some((key) =>
        richerIdentityKeys.has(key),
      )
    }

    const positionedType = expectedMappedTypeForLegacyTerminalMove(observation)
    if (positionedType === null) return true

    const candidateKeys =
      positionedType === 'TRANSSHIPMENT_POSITIONED_IN'
        ? positionedInIdentityKeys
        : positionedOutIdentityKeys

    return !buildObservationIdentityVariants(observation).some((key) => candidateKeys.has(key))
  })
}
