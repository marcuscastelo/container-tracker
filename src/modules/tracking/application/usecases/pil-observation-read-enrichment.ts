import type { TrackingUseCasesDeps } from '~/modules/tracking/application/usecases/types'
import {
  computeFingerprint,
  computeLegacyFingerprint,
  computePilLocationlessFingerprintAlias,
} from '~/modules/tracking/domain/identity/fingerprint'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import { normalizeSnapshot } from '~/modules/tracking/features/observation/application/orchestration/normalizeSnapshot'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'

type PilObservationReadFields = Pick<
  Observation,
  'location_code' | 'location_display' | 'vessel_name' | 'voyage'
>

function collectPilObservationDraftFields(
  draft: ObservationDraft,
): PilObservationReadFields | null {
  if (draft.provider !== 'pil') return null

  const hasRecoverableField =
    draft.location_code !== null ||
    draft.location_display !== null ||
    draft.vessel_name !== null ||
    draft.voyage !== null

  if (!hasRecoverableField) return null

  return {
    location_code: draft.location_code,
    location_display: draft.location_display,
    vessel_name: draft.vessel_name,
    voyage: draft.voyage,
  }
}

function registerPilObservationFingerprint(
  fieldsByFingerprint: Map<string, PilObservationReadFields>,
  fingerprint: string | null,
  fields: PilObservationReadFields,
): void {
  if (fingerprint === null) return
  if (fieldsByFingerprint.has(fingerprint)) return
  fieldsByFingerprint.set(fingerprint, fields)
}

function buildPilObservationFieldsByFingerprint(
  snapshot: Snapshot,
): ReadonlyMap<string, PilObservationReadFields> {
  const fieldsByFingerprint = new Map<string, PilObservationReadFields>()
  const drafts = normalizeSnapshot(snapshot)

  for (const draft of drafts) {
    const fields = collectPilObservationDraftFields(draft)
    if (fields === null) continue

    registerPilObservationFingerprint(fieldsByFingerprint, computeFingerprint(draft), fields)
    registerPilObservationFingerprint(fieldsByFingerprint, computeLegacyFingerprint(draft), fields)
    registerPilObservationFingerprint(
      fieldsByFingerprint,
      computePilLocationlessFingerprintAlias(draft),
      fields,
    )
  }

  return fieldsByFingerprint
}

function shouldAttemptPilReadEnrichment(observation: Observation): boolean {
  return (
    observation.provider === 'pil' &&
    observation.location_code === null &&
    observation.created_from_snapshot_id.length > 0
  )
}

function applyPilObservationReadFields(
  observation: Observation,
  fields: PilObservationReadFields,
): Observation {
  const nextLocationCode = fields.location_code ?? observation.location_code
  const nextLocationDisplay = fields.location_display ?? observation.location_display
  const nextVesselName = fields.vessel_name ?? observation.vessel_name
  const nextVoyage = fields.voyage ?? observation.voyage

  const hasChanges =
    nextLocationCode !== observation.location_code ||
    nextLocationDisplay !== observation.location_display ||
    nextVesselName !== observation.vessel_name ||
    nextVoyage !== observation.voyage

  if (!hasChanges) return observation

  return {
    ...observation,
    location_code: nextLocationCode,
    location_display: nextLocationDisplay,
    vessel_name: nextVesselName,
    voyage: nextVoyage,
  }
}

export function collectSnapshotIdsForPilObservationEnrichment(
  observations: readonly Observation[],
): readonly string[] {
  const snapshotIds = new Set<string>()

  for (const observation of observations) {
    if (!shouldAttemptPilReadEnrichment(observation)) continue
    snapshotIds.add(observation.created_from_snapshot_id)
  }

  return [...snapshotIds]
}

export async function loadSnapshotsForPilObservationEnrichment(
  deps: TrackingUseCasesDeps,
  containerId: string,
  snapshotIds: readonly string[],
): Promise<readonly Snapshot[]> {
  if (snapshotIds.length === 0) return []

  if (deps.snapshotRepository.findByIds) {
    return deps.snapshotRepository.findByIds(containerId, snapshotIds)
  }

  const allSnapshots = await deps.snapshotRepository.findAllByContainerId(containerId)
  if (allSnapshots.length === 0) return allSnapshots

  const neededSnapshotIds = new Set(snapshotIds)
  return allSnapshots.filter((snapshot) => neededSnapshotIds.has(snapshot.id))
}

export function enrichPilObservationsFromSnapshots(
  observations: readonly Observation[],
  snapshots: readonly Snapshot[],
): readonly Observation[] {
  if (observations.length === 0 || snapshots.length === 0) return observations

  const fieldsBySnapshotId = new Map<string, ReadonlyMap<string, PilObservationReadFields>>()
  for (const snapshot of snapshots) {
    fieldsBySnapshotId.set(snapshot.id, buildPilObservationFieldsByFingerprint(snapshot))
  }

  let hasChanges = false
  const enriched = observations.map((observation) => {
    if (!shouldAttemptPilReadEnrichment(observation)) {
      return observation
    }

    const fields = fieldsBySnapshotId
      .get(observation.created_from_snapshot_id)
      ?.get(observation.fingerprint)

    if (fields === undefined) {
      return observation
    }

    const nextObservation = applyPilObservationReadFields(observation, fields)
    if (nextObservation !== observation) {
      hasChanges = true
    }
    return nextObservation
  })

  return hasChanges ? enriched : observations
}
