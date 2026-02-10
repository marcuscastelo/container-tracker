import { z } from 'zod'

export const ProcessResponseSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  origin: z.object({ display_name: z.string().nullish() }).nullable().optional(),
  destination: z.object({ display_name: z.string().nullish() }).nullable().optional(),
  carrier: z.string().nullish(),
  bill_of_lading: z.string().nullish(),
  booking_number: z.string().nullish(),
  importer_name: z.string().nullish(),
  exporter_name: z.string().nullish(),
  reference_importer: z.string().nullish(),
  product: z.string().nullish(),
  redestination_number: z.string().nullish(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      carrier_code: z.string().nullish(),
    }),
  ),
})

export const ProcessListResponseSchema = z.array(ProcessResponseSchema)

export const ErrorResponseSchema = z.object({ error: z.string() })

/**
 * Observation shape as returned in the API.
 * Maps directly from the tracking domain Observation.
 */
export const ObservationResponseSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  type: z.string(),
  event_time: z.string().nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  is_empty: z.boolean().nullable(),
  confidence: z.string(),
  provider: z.string(),
  retroactive: z.boolean().optional(),
  created_at: z.string(),
})

/**
 * Tracking alert shape as returned in the API.
 * Maps from the tracking domain TrackingAlert.
 */
export const TrackingAlertResponseSchema = z.object({
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

export const ProcessDetailResponseSchema = ProcessResponseSchema.extend({
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      carrier_code: z.string().nullish(),
      /** Derived container status (from tracking pipeline) */
      status: z.string().optional(),
      /** Observations for this container (ordered by event_time) */
      observations: z.array(ObservationResponseSchema).optional(),
    }),
  ),
  /** Tracking alerts for this process (across all containers) */
  alerts: z.array(TrackingAlertResponseSchema).optional(),
})

export const CreateProcessResponseSchema = z.object({
  process: ProcessResponseSchema,
  warnings: z.array(z.string()).readonly(),
})

export type ProcessResponse = z.infer<typeof ProcessResponseSchema>
export type ProcessListResponse = z.infer<typeof ProcessListResponseSchema>
export type CreateProcessResponse = z.infer<typeof CreateProcessResponseSchema>
export type ProcessDetailResponse = z.infer<typeof ProcessDetailResponseSchema>
export type ObservationResponse = z.infer<typeof ObservationResponseSchema>
export type TrackingAlertResponse = z.infer<typeof TrackingAlertResponseSchema>
