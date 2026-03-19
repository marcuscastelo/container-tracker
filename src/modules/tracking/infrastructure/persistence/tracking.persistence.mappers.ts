/**
 * Centralized persistence mappers for tracking entities.
 *
 * Rules (per architecture guide):
 *  - snake_case stays confined here and in Row types
 *  - No Zod in infrastructure
 *  - No spreads between domain and persistence
 *  - Inconsistencies throw (infra error)
 */

import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  NewTrackingAlert,
  TrackingAlert,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import type { Confidence } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import {
  alertRowToDerivationState as mapAlertRowToDerivationState,
  alertRowToDomain as mapAlertRowToDomain,
  alertToInsertRow as mapAlertToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.alert.persistence.mappers'
import {
  requireProvider,
  requireString,
  requireTimestamp,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mapper-primitives'
import type {
  InsertTrackingAlertRow,
  InsertTrackingObservationRow,
  InsertTrackingSnapshotRow,
  TrackingAlertRow,
  TrackingObservationRow,
  TrackingSnapshotRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'
import { CalendarDate } from '~/shared/time/calendar-date'
import { Instant } from '~/shared/time/instant'
import { calendarDateValue, instantValue, type TemporalValue } from '~/shared/time/temporal-value'

const OBSERVATION_TYPE_MAP: Record<string, ObservationType> = {
  GATE_IN: 'GATE_IN',
  GATE_OUT: 'GATE_OUT',
  LOAD: 'LOAD',
  DISCHARGE: 'DISCHARGE',
  DEPARTURE: 'DEPARTURE',
  ARRIVAL: 'ARRIVAL',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
  CUSTOMS_RELEASE: 'CUSTOMS_RELEASE',
  DELIVERY: 'DELIVERY',
  EMPTY_RETURN: 'EMPTY_RETURN',
  TERMINAL_MOVE: 'TERMINAL_MOVE',
  OTHER: 'OTHER',
}

const EVENT_TIME_TYPE_MAP: Record<string, 'ACTUAL' | 'EXPECTED'> = {
  ACTUAL: 'ACTUAL',
  EXPECTED: 'EXPECTED',
}

const CONFIDENCE_MAP: Record<string, Confidence> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
}

type ObservationTemporalColumns = {
  readonly temporal_kind: 'instant' | 'date' | null
  readonly event_time_instant: string | null
  readonly event_date: string | null
}

function encodeTemporalValueForPersistence(
  value: TemporalValue | null,
): ObservationTemporalColumns {
  if (value === null) {
    return {
      temporal_kind: null,
      event_time_instant: null,
      event_date: null,
    }
  }

  if (value.kind === 'instant') {
    return {
      temporal_kind: 'instant',
      event_time_instant: value.value.toIsoString(),
      event_date: null,
    }
  }

  return {
    temporal_kind: 'date',
    event_time_instant: null,
    event_date: value.value.toIsoDate(),
  }
}

function requireTemporalKind(value: unknown, field: string): 'instant' | 'date' {
  const kind = requireString(value, field)
  if (kind === 'instant' || kind === 'date') {
    return kind
  }

  throw new Error(`tracking persistence mapper: ${field} is not a valid temporal kind: ${kind}`)
}

function observationTemporalColumnsToDomain(row: TrackingObservationRow): TemporalValue | null {
  const { temporal_kind, event_time_instant, event_date } = row

  if (temporal_kind === null) {
    if (event_time_instant === null && event_date === null) {
      // TODO: just return null instead of using event_time. For now, we are using the deprecated event_time column
      // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/242
      if (row.event_time !== null) {
        return instantValue(
          Instant.fromIso(requireTimestamp(row.event_time, 'observation.event_time')),
        )
      }
      return null
    }

    throw new Error(
      'tracking persistence mapper: observation temporal columns are inconsistent (missing temporal_kind)',
    )
  }

  const kind = requireTemporalKind(temporal_kind, 'observation.temporal_kind')

  if (kind === 'instant') {
    if (event_date !== null) {
      throw new Error(
        'tracking persistence mapper: instant observation cannot persist event_date together with event_time_instant',
      )
    }

    return instantValue(
      Instant.fromIso(requireTimestamp(event_time_instant, 'observation.event_time_instant')),
    )
  }

  if (event_time_instant !== null) {
    throw new Error(
      'tracking persistence mapper: date observation cannot persist event_time_instant together with event_date',
    )
  }

  return calendarDateValue(
    CalendarDate.fromIsoDate(requireString(event_date, 'observation.event_date')),
  )
}

function requireObservationType(value: unknown, field: string): ObservationType {
  const s = requireString(value, field)
  const mapped = OBSERVATION_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid observation type: ${s}`)
  }
  return mapped
}

function requireEventTimeType(value: unknown, field: string): 'ACTUAL' | 'EXPECTED' {
  const s = requireString(value, field)
  const mapped = EVENT_TIME_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid event_time_type: ${s}`)
  }
  return mapped
}

function requireConfidence(value: unknown, field: string): Confidence {
  const s = requireString(value, field)
  const mapped = CONFIDENCE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid confidence: ${s}`)
  }
  return mapped
}

// ---------------------------------------------------------------------------
// Observation mappers
// ---------------------------------------------------------------------------

export function observationRowToDomain(row: TrackingObservationRow): Observation {
  return {
    id: requireString(row.id, 'observation.id'),
    fingerprint: requireString(row.fingerprint, 'observation.fingerprint'),
    container_id: requireString(row.container_id, 'observation.container_id'),
    container_number: requireString(row.container_number, 'observation.container_number'),
    event_time_type: requireEventTimeType(row.event_time_type, 'observation.event_time_type'),
    type: requireObservationType(row.type, 'observation.type'),
    event_time: observationTemporalColumnsToDomain(row),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: requireConfidence(row.confidence, 'observation.confidence'),
    provider: requireProvider(row.provider, 'observation.provider'),
    created_from_snapshot_id: requireString(
      row.created_from_snapshot_id,
      'observation.created_from_snapshot_id',
    ),
    carrier_label: row.carrier_label,
    created_at: requireTimestamp(row.created_at, 'observation.created_at'),
    retroactive: row.retroactive,
  }
}

export function observationToInsertRow(obs: NewObservation): InsertTrackingObservationRow {
  const temporalColumns = encodeTemporalValueForPersistence(obs.event_time)

  return {
    fingerprint: obs.fingerprint,
    container_id: obs.container_id,
    container_number: obs.container_number,
    type: obs.type,
    temporal_kind: temporalColumns.temporal_kind,
    event_time_instant: temporalColumns.event_time_instant,
    event_date: temporalColumns.event_date,
    location_code: obs.location_code,
    location_display: obs.location_display,
    vessel_name: obs.vessel_name,
    voyage: obs.voyage,
    is_empty: obs.is_empty,
    confidence: obs.confidence,
    provider: obs.provider,
    created_from_snapshot_id: obs.created_from_snapshot_id,
    carrier_label: obs.carrier_label ?? null,
    retroactive: obs.retroactive ?? false,
    event_time_type: obs.event_time_type,
  }
}

// ---------------------------------------------------------------------------
// Snapshot mappers
// ---------------------------------------------------------------------------

export function snapshotRowToDomain(row: TrackingSnapshotRow): Snapshot {
  return {
    id: requireString(row.id, 'snapshot.id'),
    container_id: requireString(row.container_id, 'snapshot.container_id'),
    provider: requireProvider(row.provider, 'snapshot.provider'),
    fetched_at: requireTimestamp(row.fetched_at, 'snapshot.fetched_at'),
    payload: row.payload,
    parse_error: row.parse_error,
  }
}

export function snapshotToInsertRow(snapshot: NewSnapshot): InsertTrackingSnapshotRow {
  return {
    container_id: snapshot.container_id,
    provider: snapshot.provider,
    fetched_at: snapshot.fetched_at,
    payload: toJson(snapshot.payload),
    parse_error: snapshot.parse_error ?? null,
  }
}

export function alertRowToDomain(row: TrackingAlertRow): TrackingAlert {
  return mapAlertRowToDomain(row)
}

export function alertRowToDerivationState(
  row: Pick<
    TrackingAlertRow,
    | 'id'
    | 'category'
    | 'type'
    | 'message_key'
    | 'message_params'
    | 'source_observation_fingerprints'
    | 'alert_fingerprint'
    | 'acked_at'
    | 'resolved_at'
  >,
) {
  return mapAlertRowToDerivationState(row)
}

export function alertToInsertRow(alert: NewTrackingAlert): InsertTrackingAlertRow {
  return mapAlertToInsertRow(alert)
}
