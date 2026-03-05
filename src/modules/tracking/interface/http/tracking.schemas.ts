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
export type ListAlertsQuery = z.infer<typeof ListAlertsQuerySchema>

/**
 * Body for PATCH /api/alerts (acknowledge or dismiss).
 */
export const AlertActionBodySchema = z.object({
  alert_id: z.string().min(1),
  action: z.enum(['acknowledge', 'dismiss']),
})
export type AlertActionBody = z.infer<typeof AlertActionBodySchema>

// ---------------------------------------------------------------------------
// Alerts — Response DTOs
// ---------------------------------------------------------------------------

/**
 * Single alert in the API response.
 *
 * This is the HTTP-boundary shape — it does NOT leak domain entities.
 * Fields are serialisable (strings, booleans, nulls).
 */
export const AlertResponseDtoSchema = z.object({
  id: z.string(),
  category: z.string(),
  type: z.string(),
  severity: z.string(),
  message: z.string(),
  detected_at: z.string(),
  triggered_at: z.string(),
  retroactive: z.boolean(),
  provider: z.string().nullable(),
  acked_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
})
export type AlertResponseDto = z.infer<typeof AlertResponseDtoSchema>

/**
 * Response for PATCH /api/alerts.
 */
const AlertActionResponseSchema = z.object({
  ok: z.literal(true),
  alert_id: z.string(),
  action: z.enum(['acknowledge', 'dismiss']),
})
export type AlertActionResponse = z.infer<typeof AlertActionResponseSchema>

// ---------------------------------------------------------------------------
// Snapshots — Request DTOs
// ---------------------------------------------------------------------------

/**
 * Path parameters for GET /api/tracking/containers/:containerId/snapshots
 */
export const GetSnapshotsForContainerRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
})
export type GetSnapshotsForContainerRequest = z.infer<typeof GetSnapshotsForContainerRequestSchema>

/**
 * Path parameters for GET /api/tracking/containers/:containerId/snapshots/latest
 */
export const GetLatestSnapshotRequestSchema = z.object({
  containerId: z.string().min(1, 'containerId is required'),
})
export type GetLatestSnapshotRequest = z.infer<typeof GetLatestSnapshotRequestSchema>

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
