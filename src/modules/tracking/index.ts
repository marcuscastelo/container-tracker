// Tracking Module — Public API
//
// This module owns the full tracking lifecycle:
// - Fetching carrier data (REST and Puppeteer)
// - Persisting snapshots
// - Normalizing snapshots into observations
// - Deriving timeline, status and alerts

// Application (use cases, pipeline, schemas)
export {
  type ContainerTrackingSummary,
  createTrackingUseCases,
  type FetchAndProcessResult,
  RefreshSchemas,
  type TrackingUseCases,
  type TrackingUseCasesDeps,
} from '~/modules/tracking/application'
// Domain (types, schemas, pure functions)
export {
  type Confidence,
  ConfidenceSchema,
  type ContainerStatus,
  ContainerStatusSchema,
  type NewObservation,
  NewObservationSchema,
  type NewSnapshot,
  NewSnapshotSchema,
  type NewTrackingAlert,
  NewTrackingAlertSchema,
  type Observation,
  type ObservationDraft,
  ObservationDraftSchema,
  ObservationSchema,
  type ObservationType,
  ObservationTypeSchema,
  type Provider,
  ProviderSchema,
  type Snapshot,
  SnapshotSchema,
  STATUS_DOMINANCE,
  statusDominanceIndex,
  type Timeline,
  type TimelineHole,
  type TrackingAlert,
  type TrackingAlertCategory,
  TrackingAlertCategorySchema,
  TrackingAlertSchema,
  type TrackingAlertSeverity,
  TrackingAlertSeveritySchema,
  type TrackingAlertType,
  TrackingAlertTypeSchema,
  type TransshipmentInfo,
  TransshipmentInfoSchema,
} from '~/modules/tracking/domain'

// Infrastructure (repositories, fetchers)
export {
  getRestFetcher,
  isRestCarrier,
  supabaseObservationRepository,
  supabaseSnapshotRepository,
  supabaseTrackingAlertRepository,
} from '~/modules/tracking/infrastructure'

// Default use cases singleton (wired with Supabase repositories)
import { createTrackingUseCases } from '~/modules/tracking/application'
import {
  supabaseObservationRepository,
  supabaseSnapshotRepository,
  supabaseTrackingAlertRepository,
} from '~/modules/tracking/infrastructure'

export const trackingUseCases = createTrackingUseCases({
  snapshotRepository: supabaseSnapshotRepository,
  observationRepository: supabaseObservationRepository,
  trackingAlertRepository: supabaseTrackingAlertRepository,
})
