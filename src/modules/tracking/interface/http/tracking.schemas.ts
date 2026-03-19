import z from 'zod/v4'

// ---------------------------------------------------------------------------
// Alerts — Request DTOs
// ---------------------------------------------------------------------------

/**
 * Query parameters for GET /api/alerts.
 */
export const ListAlertsQuerySchema = z.object({
  container_id: z.string().min(1, 'container_id is required'),
})

/**
 * Body for PATCH /api/alerts (acknowledge or unacknowledge).
 */
export const AlertActionBodySchema = z.object({
  alert_id: z.string().min(1),
  action: z.enum(['acknowledge', 'unacknowledge']),
  // when provided, acked_by must be a non-empty string; allow null/omitted
  acked_by: z.string().min(1).nullable().optional(),
  acked_source: z.enum(['dashboard', 'process_view', 'api']).nullable().optional(),
})

// ---------------------------------------------------------------------------
// Alerts — Response DTOs
// ---------------------------------------------------------------------------

/**
 * Single alert in the API response.
 *
 * This is the HTTP-boundary shape — it does NOT leak domain entities.
 * Fields are serialisable (strings, booleans, nulls).
 */
const EmptyMessageParamsSchema = z.object({}).strict()

const AlertResponseBaseSchema = z.object({
  id: z.string(),
  container_number: z.string(),
  category: z.string(),
  type: z.string(),
  severity: z.string(),
  lifecycle_state: z.enum(['ACTIVE', 'ACKED', 'AUTO_RESOLVED']).optional(),
  detected_at: z.string(),
  triggered_at: z.string(),
  retroactive: z.boolean(),
  provider: z.string().nullable(),
  acked_at: z.string().nullable(),
  resolved_at: z.string().nullable().optional(),
  resolved_reason: z.enum(['condition_cleared', 'terminal_state']).nullable().optional(),
})

export const AlertResponseDtoSchema = z.discriminatedUnion('message_key', [
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.transshipmentDetected'),
    message_params: z
      .object({
        port: z.string(),
        fromVessel: z.string(),
        toVessel: z.string(),
      })
      .strict(),
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.customsHoldDetected'),
    message_params: z
      .object({
        location: z.string(),
      })
      .strict(),
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.noMovementDetected'),
    message_params: z
      .object({
        threshold_days: z.number(),
        days_without_movement: z.number(),
        days: z.number(),
        lastEventDate: z.string(),
      })
      .strict(),
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.etaMissing'),
    message_params: EmptyMessageParamsSchema,
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.etaPassed'),
    message_params: EmptyMessageParamsSchema,
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.portChange'),
    message_params: EmptyMessageParamsSchema,
  }),
  AlertResponseBaseSchema.extend({
    message_key: z.literal('alerts.dataInconsistent'),
    message_params: EmptyMessageParamsSchema,
  }),
])
export type AlertResponseDto = z.infer<typeof AlertResponseDtoSchema>

// ---------------------------------------------------------------------------
// Snapshots — Request DTOs
// ---------------------------------------------------------------------------

/**
 * Path parameters for GET /api/tracking/containers/:containerId/snapshots
 */
export const GetSnapshotsForContainerRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
})

/**
 * Path parameters for GET /api/tracking/containers/:containerId/snapshots/latest
 */
export const GetLatestSnapshotRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
})

export const GetTrackingTimeTravelRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
  now: z.string().optional(),
})

export const GetTrackingReplayDebugRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
  snapshotId: z.string().min(1, 'snapshotId is required'),
  now: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Snapshots — Response DTOs
// ---------------------------------------------------------------------------

/**
 * Single snapshot in the API response (minimal DTO).
 *
 * payload_json is excluded by default to avoid large responses.
 */
export const SnapshotResponseDtoSchema = z.object({
  id: z.string(),
  container_id: z.string(),
  provider: z.string(),
  fetched_at: z.string(),
  parse_error: z.string().nullable().optional(),
})
export type SnapshotResponseDto = z.infer<typeof SnapshotResponseDtoSchema>

const ReplayObservationResponseDtoSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  type: z.string(),
  carrier_label: z.string().nullable(),
  event_time: z.string().nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  is_empty: z.boolean().nullable(),
  confidence: z.string(),
  provider: z.string(),
  created_from_snapshot_id: z.string(),
  retroactive: z.boolean(),
  created_at: z.string(),
})

const ReplayTimelineSeriesItemResponseDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  event_time: z.string().nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  created_at: z.string(),
  series_label: z.enum([
    'ACTIVE',
    'EXPIRED',
    'REDUNDANT_AFTER_ACTUAL',
    'SUPERSEDED_EXPECTED',
    'CONFIRMED',
    'CONFLICTING_ACTUAL',
  ]),
})

const ReplaySeriesResponseDtoSchema = z.object({
  key: z.string(),
  primary: z.object({
    id: z.string(),
    type: z.string(),
    event_time: z.string().nullable(),
    event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  }),
  has_actual_conflict: z.boolean(),
  items: z.array(ReplayTimelineSeriesItemResponseDtoSchema),
})

export const TrackingTimelineItemResponseDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  carrier_label: z.string().nullable(),
  location: z.string().nullable(),
  event_time_iso: z.string().nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  derived_state: z.enum(['ACTUAL', 'ACTIVE_EXPECTED', 'EXPIRED_EXPECTED']),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  series_history: z
    .object({
      has_actual_conflict: z.boolean(),
      classified: z.array(ReplayTimelineSeriesItemResponseDtoSchema),
    })
    .nullable(),
})

export const TrackingOperationalEtaResponseDtoSchema = z.object({
  event_time: z.string(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  state: z.enum(['ACTUAL', 'ACTIVE_EXPECTED', 'EXPIRED_EXPECTED']),
  type: z.string(),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
})

const ReplayStateResponseDtoSchema = z.object({
  observations: z.array(ReplayObservationResponseDtoSchema),
  series: z.array(ReplaySeriesResponseDtoSchema),
  timeline: z.array(TrackingTimelineItemResponseDtoSchema),
  status: z.string(),
  alerts: z.array(AlertResponseDtoSchema),
})

export const TrackingReplayStepResponseDtoSchema = z.object({
  step_index: z.number().int().positive(),
  snapshot_id: z.string().nullable(),
  observation_id: z.string().nullable(),
  stage: z.enum(['SNAPSHOT', 'OBSERVATION', 'SERIES', 'TIMELINE', 'STATUS', 'ALERT']),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string(),
  state: ReplayStateResponseDtoSchema,
})

const TrackingTimeTravelDiffComparisonResponseDtoSchema = z.object({
  kind: z.literal('comparison'),
  status_changed: z.boolean(),
  previous_status: z.string(),
  current_status: z.string(),
  timeline_changed: z.boolean(),
  added_timeline_item_ids: z.array(z.string()),
  removed_timeline_item_ids: z.array(z.string()),
  alerts_changed: z.boolean(),
  new_alert_fingerprints: z.array(z.string()),
  resolved_alert_fingerprints: z.array(z.string()),
  eta_changed: z.boolean(),
  previous_eta: TrackingOperationalEtaResponseDtoSchema.nullable(),
  current_eta: TrackingOperationalEtaResponseDtoSchema.nullable(),
  actual_conflict_appeared: z.boolean(),
  actual_conflict_resolved: z.boolean(),
})

export const TrackingTimeTravelDiffResponseDtoSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('initial'),
  }),
  TrackingTimeTravelDiffComparisonResponseDtoSchema,
])
export type TrackingTimeTravelDiffResponseDto = z.infer<
  typeof TrackingTimeTravelDiffResponseDtoSchema
>

export const TrackingTimeTravelCheckpointResponseDtoSchema = z.object({
  snapshot_id: z.string(),
  fetched_at: z.string(),
  position: z.number().int().positive(),
  timeline: z.array(TrackingTimelineItemResponseDtoSchema),
  status: z.string(),
  alerts: z.array(AlertResponseDtoSchema),
  eta: TrackingOperationalEtaResponseDtoSchema.nullable(),
  diff_from_previous: TrackingTimeTravelDiffResponseDtoSchema,
  debug_available: z.literal(true),
})
export type TrackingTimeTravelCheckpointResponseDto = z.infer<
  typeof TrackingTimeTravelCheckpointResponseDtoSchema
>

export const TrackingTimeTravelResponseDtoSchema = z.object({
  container_id: z.string(),
  container_number: z.string().nullable(),
  reference_now: z.string(),
  selected_snapshot_id: z.string().nullable(),
  sync_count: z.number().int().nonnegative(),
  syncs: z.array(TrackingTimeTravelCheckpointResponseDtoSchema),
})
export type TrackingTimeTravelResponseDto = z.infer<typeof TrackingTimeTravelResponseDtoSchema>

export const TrackingReplayDebugResponseDtoSchema = z.object({
  container_id: z.string(),
  container_number: z.string().nullable(),
  snapshot_id: z.string(),
  fetched_at: z.string(),
  position: z.number().int().positive(),
  reference_now: z.string(),
  total_observations: z.number().int().nonnegative(),
  total_steps: z.number().int().nonnegative(),
  steps: z.array(TrackingReplayStepResponseDtoSchema),
  checkpoint: TrackingTimeTravelCheckpointResponseDtoSchema,
})
export type TrackingReplayDebugResponseDto = z.infer<typeof TrackingReplayDebugResponseDtoSchema>
