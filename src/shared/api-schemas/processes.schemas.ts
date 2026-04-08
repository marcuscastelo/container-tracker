import { z } from 'zod'
import {
  AlertResponseDtoSchema,
  TrackingValidationIssueResponseDtoSchema,
} from '~/modules/tracking/interface/http/tracking.schemas'
import { TemporalValueDtoSchema } from '~/shared/api-schemas/temporal.schemas'

const ProcessLastSyncStatusSchema = z.enum(['DONE', 'FAILED', 'RUNNING', 'UNKNOWN'])
const ProcessStatusMicrobadgeStatusSchema = z.enum([
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
])

const ProcessStatusCountsSchema = z.object({
  UNKNOWN: z.number().int().nonnegative(),
  IN_PROGRESS: z.number().int().nonnegative(),
  LOADED: z.number().int().nonnegative(),
  IN_TRANSIT: z.number().int().nonnegative(),
  ARRIVED_AT_POD: z.number().int().nonnegative(),
  DISCHARGED: z.number().int().nonnegative(),
  AVAILABLE_FOR_PICKUP: z.number().int().nonnegative(),
  DELIVERED: z.number().int().nonnegative(),
  EMPTY_RETURNED: z.number().int().nonnegative(),
})

const ProcessStatusMicrobadgeSchema = z.object({
  status: ProcessStatusMicrobadgeStatusSchema,
  count: z.number().int().positive(),
})

const EtaDisplayResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('date'),
    value: TemporalValueDtoSchema,
  }),
  z.object({
    kind: z.literal('arrived'),
    value: TemporalValueDtoSchema,
  }),
  z.object({
    kind: z.literal('unavailable'),
  }),
  z.object({
    kind: z.literal('delivered'),
  }),
])

const TrackingValidationSeveritySchema = z.enum(['info', 'warning', 'danger'])

const ProcessTrackingValidationResponseSchema = z.object({
  has_issues: z.boolean(),
  highest_severity: TrackingValidationSeveritySchema.nullable(),
  affected_container_count: z.number().int().nonnegative(),
  top_issue: TrackingValidationIssueResponseDtoSchema.nullable(),
})

const ContainerTrackingValidationResponseSchema = z.object({
  has_issues: z.boolean(),
  highest_severity: TrackingValidationSeveritySchema.nullable(),
  finding_count: z.number().int().nonnegative(),
  active_issues: z.array(TrackingValidationIssueResponseDtoSchema),
})

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
  depositary: z.string().nullish(),
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
  highest_container_status: ProcessStatusMicrobadgeStatusSchema.nullish(),
  status_counts: ProcessStatusCountsSchema.optional(),
  status_microbadge: ProcessStatusMicrobadgeSchema.nullish(),
  has_status_dispersion: z.boolean().optional(),
  lifecycle_bucket: z
    .enum(['pre_arrival', 'post_arrival_pre_delivery', 'final_delivery'])
    .optional(),
  final_delivery_complete: z.boolean().optional(),
  full_logistics_complete: z.boolean().optional(),
  /** Earliest future ETA across containers */
  eta: TemporalValueDtoSchema.nullish(),
  eta_display: EtaDisplayResponseSchema.optional(),
  eta_coverage: z
    .object({
      total: z.number(),
      eligible_total: z.number(),
      with_eta: z.number(),
    })
    .optional(),
  /** Total active alerts across containers */
  alerts_count: z.number().optional(),
  /** Highest alert severity across containers */
  highest_alert_severity: z.enum(['info', 'warning', 'danger']).nullish(),
  /** Dashboard triage severity derived in backend from alerts + critical validation */
  attention_severity: z.enum(['info', 'warning', 'danger']).nullish(),
  /** Timestamp for dominant alert age rendering in dashboard */
  dominant_alert_created_at: z.string().nullish(),
  /** Tracking-owned validation signal aggregated across containers */
  tracking_validation: ProcessTrackingValidationResponseSchema,
  /** Whether any container has a transshipment alert */
  has_transshipment: z.boolean().optional(),
  /** Latest event time across all container timelines */
  last_event_at: TemporalValueDtoSchema.nullish(),
  /** Last process sync status derived from sync_requests */
  last_sync_status: ProcessLastSyncStatusSchema.optional(),
  /** Timestamp of latest known process sync activity */
  last_sync_at: z.string().nullish(),
})

export const ProcessListResponseSchema = z.array(ProcessResponseSchema)

export const ProcessesV2ResponseSchema = z.object({
  generated_at: z.string(),
  processes: ProcessListResponseSchema,
})

/**
 * Observation shape as returned in the API.
 * Maps directly from the tracking domain Observation.
 */
export const ObservationResponseSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  type: z.string(),
  carrier_label: z.string().nullable().optional(),
  event_time: TemporalValueDtoSchema.nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  raw_event_time: z.string().nullish(),
  event_time_source: z.string().nullish(),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  is_empty: z.boolean().nullable(),
  confidence: z.string(),
  provider: z.string(),
  created_from_snapshot_id: z.string().optional(),
  retroactive: z.boolean().optional(),
  created_at: z.string(),
})

const TrackingAlertResponseSchema = AlertResponseDtoSchema

const ShipmentAlertIncidentMessageParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()]),
)

const ShipmentAlertIncidentRecordResponseSchema = z.object({
  alert_id: z.string(),
  lifecycle_state: z.enum(['ACTIVE', 'ACKED', 'AUTO_RESOLVED']),
  detected_at: z.string(),
  triggered_at: z.string(),
  acked_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_reason: z.enum(['condition_cleared', 'terminal_state']).nullable(),
  threshold_days: z.number().nullable(),
  days_without_movement: z.number().nullable(),
  last_event_date: z.string().nullable(),
})

const ShipmentAlertIncidentMemberResponseSchema = z.object({
  container_id: z.string(),
  container_number: z.string(),
  lifecycle_state: z.enum(['ACTIVE', 'ACKED', 'AUTO_RESOLVED']),
  detected_at: z.string(),
  threshold_days: z.number().nullable(),
  days_without_movement: z.number().nullable(),
  last_event_date: z.string().nullable(),
  transshipment_order: z.number().int().nullable(),
  port: z.string().nullable(),
  from_vessel: z.string().nullable(),
  to_vessel: z.string().nullable(),
  records: z.array(ShipmentAlertIncidentRecordResponseSchema),
})

const ShipmentAlertIncidentResponseSchema = z.object({
  incident_key: z.string(),
  bucket: z.enum(['active', 'recognized']),
  category: z.enum(['movement', 'eta', 'customs', 'status', 'data']),
  type: z.enum([
    'TRANSSHIPMENT',
    'CUSTOMS_HOLD',
    'PORT_CHANGE',
    'NO_MOVEMENT',
    'ETA_PASSED',
    'ETA_MISSING',
    'DATA_INCONSISTENT',
  ]),
  severity: z.enum(['info', 'warning', 'danger']),
  message_key: z.enum([
    'alerts.transshipmentDetected',
    'alerts.customsHoldDetected',
    'alerts.noMovementDetected',
    'alerts.etaMissing',
    'alerts.etaPassed',
    'alerts.portChange',
    'alerts.dataInconsistent',
  ]),
  message_params: ShipmentAlertIncidentMessageParamsSchema,
  detected_at: z.string(),
  triggered_at: z.string(),
  threshold_days: z.number().nullable(),
  days_without_movement: z.number().nullable(),
  last_event_date: z.string().nullable(),
  transshipment_order: z.number().int().nullable(),
  port: z.string().nullable(),
  from_vessel: z.string().nullable(),
  to_vessel: z.string().nullable(),
  affected_container_count: z.number().int().nonnegative(),
  active_alert_ids: z.array(z.string()),
  acked_alert_ids: z.array(z.string()),
  members: z.array(ShipmentAlertIncidentMemberResponseSchema),
  monitoring_history: z.array(ShipmentAlertIncidentRecordResponseSchema),
})

const ShipmentAlertIncidentsSummaryResponseSchema = z.object({
  summary: z.object({
    active_incidents: z.number().int().nonnegative(),
    affected_containers: z.number().int().nonnegative(),
    recognized_incidents: z.number().int().nonnegative(),
  }),
})

const ShipmentAlertIncidentsResponseSchema = ShipmentAlertIncidentsSummaryResponseSchema.extend({
  active: z.array(ShipmentAlertIncidentResponseSchema),
  recognized: z.array(ShipmentAlertIncidentResponseSchema).optional(),
})

const OperationalEtaResponseSchema = z.object({
  event_time: TemporalValueDtoSchema,
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  state: z.enum(['ACTUAL', 'ACTIVE_EXPECTED', 'EXPIRED_EXPECTED']),
  type: z.string(),
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
})

const OperationalCurrentContextResponseSchema = z.object({
  location_code: z.string().nullable(),
  location_display: z.string().nullable(),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  vessel_visible: z.boolean(),
})

const OperationalNextLocationResponseSchema = z.object({
  event_time: TemporalValueDtoSchema,
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
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
  eta_display: EtaDisplayResponseSchema.optional(),
  eta_applicable: z.boolean().optional(),
  lifecycle_bucket: z
    .enum(['pre_arrival', 'post_arrival_pre_delivery', 'final_delivery'])
    .optional(),
  current_context: OperationalCurrentContextResponseSchema,
  next_location: OperationalNextLocationResponseSchema.nullable(),
  transshipment: OperationalTransshipmentResponseSchema,
  data_issue: z.boolean().optional(),
})

const ProcessOperationalResponseSchema = z.object({
  derived_status: z.string(),
  highest_container_status: ProcessStatusMicrobadgeStatusSchema.nullish(),
  status_counts: ProcessStatusCountsSchema.optional(),
  status_microbadge: ProcessStatusMicrobadgeSchema.nullish(),
  has_status_dispersion: z.boolean().optional(),
  eta_max: OperationalEtaResponseSchema.nullable(),
  eta_display: EtaDisplayResponseSchema.optional(),
  coverage: z.object({
    total: z.number(),
    eligible_total: z.number().optional(),
    with_eta: z.number(),
  }),
  lifecycle_bucket: z
    .enum(['pre_arrival', 'post_arrival_pre_delivery', 'final_delivery'])
    .optional(),
  final_delivery_complete: z.boolean().optional(),
  full_logistics_complete: z.boolean().optional(),
})

const TrackingSeriesLabelSchema = z.enum([
  'ACTIVE',
  'EXPIRED',
  'REDUNDANT_AFTER_ACTUAL',
  'SUPERSEDED_EXPECTED',
  'CONFIRMED',
  'CONFLICTING_ACTUAL',
])

const TrackingTimelineSeriesItemResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  event_time: TemporalValueDtoSchema.nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  created_at: z.string(),
  series_label: TrackingSeriesLabelSchema,
})

export const TrackingTimelineSeriesHistoryResponseSchema = z.object({
  has_actual_conflict: z.boolean(),
  classified: z.array(TrackingTimelineSeriesItemResponseSchema),
})

const TrackingTimelineItemResponseSchema = z.object({
  id: z.string(),
  observation_id: z.string().nullable(),
  type: z.string(),
  carrier_label: z.string().nullable(),
  location: z.string().nullable(),
  event_time: TemporalValueDtoSchema.nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  derived_state: z.enum(['ACTUAL', 'ACTIVE_EXPECTED', 'EXPIRED_EXPECTED']),
  vessel_name: z.string().nullable(),
  voyage: z.string().nullable(),
  has_series_history: z.boolean(),
  series_history: TrackingTimelineSeriesHistoryResponseSchema.nullable(),
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
  tracking_freshness_token: z.string(),
  containers: z.array(
    z.object({
      id: z.string(),
      container_number: z.string(),
      carrier_code: z.string().nullish(),
      /** Derived container status (from tracking pipeline) */
      status: z.string().optional(),
      /** Timeline read-model derived in backend (safe-first series-aware) */
      timeline: z.array(TrackingTimelineItemResponseSchema).optional(),
      /** Container-level operational projection */
      operational: ContainerOperationalResponseSchema.optional(),
      /** Tracking validation summary owned by Tracking BC */
      tracking_validation: ContainerTrackingValidationResponseSchema,
    }),
  ),
  /** Active tracking alerts for this process (across all containers) */
  alerts: z.array(TrackingAlertResponseSchema).optional(),
  /** Compact incident-oriented shipment alert projection (active only on hot path) */
  alert_incidents: ShipmentAlertIncidentsResponseSchema.optional(),
  /** Process-level operational projection */
  process_operational: ProcessOperationalResponseSchema.optional(),
  /** Container-level operational sync metadata */
  containersSync: z.array(ContainerSyncResponseSchema),
})

export const ProcessSyncSnapshotResponseSchema = z.object({
  tracking_freshness_token: z.string(),
  containersSync: z.array(ContainerSyncResponseSchema),
})

export const ProcessRecognizedAlertIncidentsResponseSchema =
  ShipmentAlertIncidentsSummaryResponseSchema.extend({
    recognized: z.array(ShipmentAlertIncidentResponseSchema),
  })

export const CreateProcessResponseSchema = z.object({
  process: ProcessResponseSchema,
  warnings: z.array(z.string()).readonly(),
})

export const SyncAllProcessesResponseSchema = z.object({
  ok: z.literal(true),
  syncedProcesses: z.number().int().nonnegative(),
  syncedContainers: z.number().int().nonnegative(),
})

export const SyncProcessResponseSchema = z.object({
  ok: z.literal(true),
  processId: z.string(),
  syncedContainers: z.number().int().nonnegative(),
})

const ProcessSyncVisibilitySchema = z.enum(['active', 'archived_in_flight'])
const ProcessSyncStateSchema = z.enum(['idle', 'syncing', 'completed', 'failed'])

const ProcessSyncStateResponseSchema = z.object({
  process_id: z.string(),
  sync_status: ProcessSyncStateSchema,
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  container_count: z.number().int().nonnegative(),
  completed_containers: z.number().int().nonnegative(),
  failed_containers: z.number().int().nonnegative(),
  visibility: ProcessSyncVisibilitySchema,
})

export const ProcessesSyncStatusResponseSchema = z.object({
  generated_at: z.string(),
  processes: z.array(ProcessSyncStateResponseSchema),
})

const ProcessRefreshRequestItemSchema = z.object({
  container_number: z.string(),
  sync_request_id: z.string().uuid(),
  deduped: z.boolean(),
})

const ProcessRefreshFailureItemSchema = z.object({
  container_number: z.string(),
  error: z.string(),
})

export const ProcessRefreshResponseSchema = z.object({
  ok: z.literal(true),
  processId: z.string(),
  mode: z.enum(['process', 'container']),
  requestedContainers: z.number().int().nonnegative(),
  queuedContainers: z.number().int().nonnegative(),
  syncRequestIds: z.array(z.string().uuid()),
  requests: z.array(ProcessRefreshRequestItemSchema),
  failures: z.array(ProcessRefreshFailureItemSchema),
})

export type ProcessDetailResponse = z.infer<typeof ProcessDetailResponseSchema>
export type ProcessSyncSnapshotResponse = z.infer<typeof ProcessSyncSnapshotResponseSchema>
