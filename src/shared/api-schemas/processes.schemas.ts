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
  /** Importer identifier, may be missing from older API responses */
  importer_id: z.string().nullish(),
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
  /** Derived process status (from tracking pipeline aggregation) */
  process_status: z.string().optional(),
  /** Earliest future ETA across containers */
  eta: z.string().nullish(),
  /** Total active alerts across containers */
  alerts_count: z.number().optional(),
  /** Highest alert severity across containers */
  highest_alert_severity: z.enum(['info', 'warning', 'danger']).nullish(),
  /** Whether any container has a transshipment alert */
  has_transshipment: z.boolean().optional(),
  /** Latest event time across all container timelines */
  last_event_at: z.string().nullish(),
})

export const ProcessListResponseSchema = z.array(ProcessResponseSchema)

/**
 * Observation shape as returned in the API.
 * Maps directly from the tracking domain Observation.
 */
const ObservationResponseSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  type: z.string(),
  carrier_label: z.string().nullable().optional(),
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
const TrackingAlertResponseSchema = z.object({
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
})

const OperationalEtaResponseSchema = z.object({
  event_time: z.string(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  state: z.enum(['ACTUAL', 'ACTIVE_EXPECTED', 'EXPIRED_EXPECTED']),
  type: z.string(),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
})

const OperationalTransshipmentPortResponseSchema = z.object({
  code: z.string(),
  display: z.string().nullable(),
})

const OperationalTransshipmentResponseSchema = z.object({
  has_transshipment: z.boolean(),
  count: z.number(),
  ports: z.array(OperationalTransshipmentPortResponseSchema),
})

const ContainerOperationalResponseSchema = z.object({
  status: z.string(),
  eta: OperationalEtaResponseSchema.nullable(),
  transshipment: OperationalTransshipmentResponseSchema,
  data_issue: z.boolean().optional(),
})

const ProcessOperationalResponseSchema = z.object({
  eta_max: OperationalEtaResponseSchema.nullable(),
  coverage: z.object({
    total: z.number(),
    with_eta: z.number(),
  }),
})

const ContainerSyncResponseSchema = z.object({
  containerNumber: z.string(),
  carrier: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  isSyncing: z.boolean(),
  lastErrorCode: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
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
      /** Container-level operational projection */
      operational: ContainerOperationalResponseSchema.optional(),
    }),
  ),
  /** Tracking alerts for this process (across all containers) */
  alerts: z.array(TrackingAlertResponseSchema).optional(),
  /** Process-level operational projection */
  process_operational: ProcessOperationalResponseSchema.optional(),
  /** Container-level operational sync metadata */
  containersSync: z.array(ContainerSyncResponseSchema),
})

export const CreateProcessResponseSchema = z.object({
  process: ProcessResponseSchema,
  warnings: z.array(z.string()).readonly(),
})

export type ProcessDetailResponse = z.infer<typeof ProcessDetailResponseSchema>
