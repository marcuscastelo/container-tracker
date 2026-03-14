import { z } from 'zod'

import { typedFetch } from '~/shared/api/typedFetch'

const ReplayAlertSchema = z.object({
  id: z.string(),
  container_number: z.string(),
  category: z.string(),
  type: z.string(),
  severity: z.string(),
  message_key: z.string(),
  message_params: z.record(z.string(), z.unknown()),
  lifecycle_state: z.enum(['ACTIVE', 'ACKED', 'AUTO_RESOLVED']).optional(),
  detected_at: z.string(),
  triggered_at: z.string(),
  retroactive: z.boolean(),
  provider: z.string().nullable(),
  acked_at: z.string().nullable(),
  resolved_at: z.string().nullable().optional(),
  resolved_reason: z.enum(['condition_cleared', 'terminal_state']).nullable().optional(),
})

const ReplayObservationSchema = z.object({
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

const ReplayTimelineSeriesItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  event_time: z.string().nullable(),
  event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  created_at: z.string(),
  series_label: z.string(),
})

const ReplayTimelineItemSchema = z.object({
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
      classified: z.array(ReplayTimelineSeriesItemSchema),
    })
    .nullable(),
})

const ReplaySeriesSchema = z.object({
  key: z.string(),
  primary: z.object({
    id: z.string(),
    type: z.string(),
    event_time: z.string().nullable(),
    event_time_type: z.enum(['ACTUAL', 'EXPECTED']),
  }),
  has_actual_conflict: z.boolean(),
  items: z.array(ReplayTimelineSeriesItemSchema),
})

const ReplayStateSchema = z.object({
  observations: z.array(ReplayObservationSchema),
  series: z.array(ReplaySeriesSchema),
  timeline: z.array(ReplayTimelineItemSchema),
  status: z.string(),
  alerts: z.array(ReplayAlertSchema),
})

const ReplayStepSchema = z.object({
  step_index: z.number().int().positive(),
  snapshot_id: z.string().nullable(),
  observation_id: z.string().nullable(),
  stage: z.enum(['SNAPSHOT', 'OBSERVATION', 'SERIES', 'TIMELINE', 'STATUS', 'ALERT']),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string(),
  state: ReplayStateSchema,
})

export const TrackingReplayResponseSchema = z.object({
  container_id: z.string(),
  container_number: z.string().nullable(),
  reference_now: z.string(),
  total_snapshots: z.number().int().nonnegative(),
  total_observations: z.number().int().nonnegative(),
  total_steps: z.number().int().nonnegative(),
  steps: z.array(ReplayStepSchema),
  final_timeline: z.array(ReplayTimelineItemSchema),
  final_status: z.string(),
  final_alerts: z.array(ReplayAlertSchema),
  production_comparison: z.object({
    timeline_matches: z.boolean(),
    status_matches: z.boolean(),
    alerts_match: z.boolean(),
  }),
})

export type TrackingReplayResponse = z.infer<typeof TrackingReplayResponseSchema>

export async function fetchTrackingReplay(containerId: string): Promise<TrackingReplayResponse> {
  return typedFetch(`/api/tracking/replay/${containerId}`, undefined, TrackingReplayResponseSchema)
}
