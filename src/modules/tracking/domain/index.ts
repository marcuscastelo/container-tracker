// Tracking Domain — public API
// All canonical types, schemas and pure functions.

export {
  type ContainerStatus,
  ContainerStatusSchema,
  STATUS_DOMINANCE,
  statusDominanceIndex,
} from '~/modules/tracking/domain/containerStatus'

export {
  type NewObservation,
  NewObservationSchema,
  type Observation,
  ObservationSchema,
  type EventTimeType,
  EventTimeTypeSchema,
} from '~/modules/tracking/domain/observation'

export {
  type Confidence,
  ConfidenceSchema,
  type ObservationDraft,
  ObservationDraftSchema,
} from '~/modules/tracking/domain/observationDraft'

export {
  type ObservationType,
  ObservationTypeSchema,
} from '~/modules/tracking/domain/observationType'

export { type Provider, ProviderSchema } from '~/modules/tracking/domain/provider'

export {
  type NewSnapshot,
  NewSnapshotSchema,
  type Snapshot,
  SnapshotSchema,
} from '~/modules/tracking/domain/snapshot'

export { type Timeline, type TimelineHole } from '~/modules/tracking/domain/timeline'

export {
  type NewTrackingAlert,
  NewTrackingAlertSchema,
  type TrackingAlert,
  type TrackingAlertCategory,
  TrackingAlertCategorySchema,
  TrackingAlertSchema,
  type TrackingAlertSeverity,
  TrackingAlertSeveritySchema,
  type TrackingAlertType,
  TrackingAlertTypeSchema,
} from '~/modules/tracking/domain/trackingAlert'

export {
  type TransshipmentInfo,
  TransshipmentInfoSchema,
} from '~/modules/tracking/domain/transshipment'
