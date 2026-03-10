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
  detected_at: z.string(),
  triggered_at: z.string(),
  retroactive: z.boolean(),
  provider: z.string().nullable(),
  acked_at: z.string().nullable(),
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
