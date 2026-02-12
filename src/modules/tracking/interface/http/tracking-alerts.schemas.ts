import z from 'zod/v4'

// ---------------------------------------------------------------------------
// Request DTOs
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
// Response DTOs
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
export const AlertActionResponseSchema = z.object({
  ok: z.literal(true),
  alert_id: z.string(),
  action: z.enum(['acknowledge', 'dismiss']),
})
export type AlertActionResponse = z.infer<typeof AlertActionResponseSchema>
