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

export const GetTrackingReplayRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
  now: z.string().optional(),
})

export const GetTrackingReplayStepsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(5000).optional(),
  cursor: z.coerce.number().int().nonnegative().optional(),
  now: z.string().optional(),
})

export const GetTrackingReplayStepSnapshotRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
  step: z.coerce.number().int().positive(),
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
  series_label: z.string(),
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

const ReplayTimelineItemResponseDtoSchema = z.object({
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

const ReplayStateResponseDtoSchema = z.object({
  observations: z.array(ReplayObservationResponseDtoSchema),
  series: z.array(ReplaySeriesResponseDtoSchema),
  timeline: z.array(ReplayTimelineItemResponseDtoSchema),
  status: z.string(),
  alerts: z.array(AlertResponseDtoSchema),
})

const ReplayStepResponseDtoSchema = z.object({
  step_index: z.number().int().positive(),
  snapshot_id: z.string().nullable(),
  observation_id: z.string().nullable(),
  stage: z.enum(['SNAPSHOT', 'OBSERVATION', 'SERIES', 'TIMELINE', 'STATUS', 'ALERT']),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string(),
  state: ReplayStateResponseDtoSchema,
})

export const TrackingReplayResultResponseDtoSchema = z.object({
  container_id: z.string(),
  container_number: z.string().nullable(),
  reference_now: z.string(),
  total_snapshots: z.number().int().nonnegative(),
  total_observations: z.number().int().nonnegative(),
  total_steps: z.number().int().nonnegative(),
  steps: z.array(ReplayStepResponseDtoSchema),
  final_timeline: z.array(ReplayTimelineItemResponseDtoSchema),
  final_status: z.string(),
  final_alerts: z.array(AlertResponseDtoSchema),
  production_comparison: z.object({
    timeline_matches: z.boolean(),
    status_matches: z.boolean(),
    alerts_match: z.boolean(),
  }),
})
export type TrackingReplayResultResponseDto = z.infer<typeof TrackingReplayResultResponseDtoSchema>

export const TrackingReplayStepsResponseDtoSchema = z.object({
  container_id: z.string(),
  total_steps: z.number().int().nonnegative(),
  next_cursor: z.number().int().nonnegative().nullable(),
  steps: z.array(ReplayStepResponseDtoSchema),
})
export type TrackingReplayStepsResponseDto = z.infer<typeof TrackingReplayStepsResponseDtoSchema>

export const TrackingReplayStepSnapshotResponseDtoSchema = z.object({
  container_id: z.string(),
  step_index: z.number().int().positive(),
  step: ReplayStepResponseDtoSchema,
})
export type TrackingReplayStepSnapshotResponseDto = z.infer<
  typeof TrackingReplayStepSnapshotResponseDtoSchema
>
