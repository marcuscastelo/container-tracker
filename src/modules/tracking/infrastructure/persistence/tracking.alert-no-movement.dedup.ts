import type { NewTrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'

const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

export type NoMovementDedupRow = {
  readonly container_id: string
  readonly category: string
  readonly type: string
  readonly message_key: string
  readonly message_params: unknown
  readonly source_observation_fingerprints: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function normalizeNoMovementThresholdDays(rawThresholdDays: number): number {
  const normalizedCandidate = Math.floor(rawThresholdDays)
  const eligible = NO_MOVEMENT_BREAKPOINTS_DAYS.filter(
    (thresholdDays) => normalizedCandidate >= thresholdDays,
  )
  if (eligible.length === 0) return normalizedCandidate
  return eligible[eligible.length - 1] ?? normalizedCandidate
}

function toNoMovementThresholdDaysFromParams(messageParams: unknown): number | null {
  if (!isRecord(messageParams)) return null

  const days = toFiniteNumberOrNull(messageParams.days)
  const rawThresholdDays = toFiniteNumberOrNull(messageParams.threshold_days) ?? days
  if (rawThresholdDays === null) return null

  return normalizeNoMovementThresholdDays(rawThresholdDays)
}

function toNoMovementDateDedupKeyFromParams(
  containerId: string,
  messageParams: unknown,
  normalizedThresholdDays: number,
): string | null {
  if (!isRecord(messageParams)) return null

  const lastEventDateValue = messageParams.lastEventDate
  if (typeof lastEventDateValue !== 'string') return null
  const lastEventDate = lastEventDateValue.trim()
  if (lastEventDate.length === 0) return null

  // Prefer adding a timestamp suffix when available to avoid false
  // deduplication when late-arriving observations change the latest
  // movement within the same calendar day. The message payload may include
  // a `lastEventTimestamp` field (string or number) as a more specific anchor.
  let timestampSuffix = ''
  const lastEventTimestampValue = messageParams.lastEventTimestamp
  if (typeof lastEventTimestampValue === 'string') {
    const ts = lastEventTimestampValue.trim()
    if (ts.length > 0) timestampSuffix = `|ts:${ts}`
  } else if (
    typeof lastEventTimestampValue === 'number' &&
    Number.isFinite(lastEventTimestampValue)
  ) {
    timestampSuffix = `|ts:${lastEventTimestampValue}`
  }

  return `${containerId}|date:${lastEventDate}${timestampSuffix}|threshold:${normalizedThresholdDays}`
}

function toNoMovementSourceDedupKeys(
  containerId: string,
  normalizedThresholdDays: number,
  sourceObservationFingerprints: unknown,
): readonly string[] {
  if (!Array.isArray(sourceObservationFingerprints)) return []

  const keys: string[] = []
  for (const value of sourceObservationFingerprints) {
    if (typeof value !== 'string') continue
    const fingerprint = value.trim()
    if (fingerprint.length === 0) continue
    keys.push(`${containerId}|source:${fingerprint}|threshold:${normalizedThresholdDays}`)
  }

  return Array.from(new Set(keys))
}

export function toNoMovementDedupKeysFromAlert(alert: NewTrackingAlert): readonly string[] {
  if (alert.category !== 'monitoring') return []
  if (alert.type !== 'NO_MOVEMENT') return []
  if (alert.message_key !== 'alerts.noMovementDetected') return []

  const normalizedThresholdDays = toNoMovementThresholdDaysFromParams(alert.message_params)
  if (normalizedThresholdDays === null) return []

  const dedupKeys: string[] = []
  const byDate = toNoMovementDateDedupKeyFromParams(
    alert.container_id,
    alert.message_params,
    normalizedThresholdDays,
  )
  if (byDate !== null) dedupKeys.push(byDate)

  dedupKeys.push(
    ...toNoMovementSourceDedupKeys(
      alert.container_id,
      normalizedThresholdDays,
      alert.source_observation_fingerprints,
    ),
  )

  return dedupKeys
}

export function toNoMovementDedupKeysFromRow(row: NoMovementDedupRow): readonly string[] {
  if (row.category !== 'monitoring') return []
  if (row.type !== 'NO_MOVEMENT') return []
  if (row.message_key !== 'alerts.noMovementDetected') return []

  const normalizedThresholdDays = toNoMovementThresholdDaysFromParams(row.message_params)
  if (normalizedThresholdDays === null) return []

  const dedupKeys: string[] = []
  const byDate = toNoMovementDateDedupKeyFromParams(
    row.container_id,
    row.message_params,
    normalizedThresholdDays,
  )
  if (byDate !== null) dedupKeys.push(byDate)

  dedupKeys.push(
    ...toNoMovementSourceDedupKeys(
      row.container_id,
      normalizedThresholdDays,
      row.source_observation_fingerprints,
    ),
  )

  return dedupKeys
}
