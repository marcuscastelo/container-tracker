import { createTrackingUseCases } from '~/modules/tracking/application/trackingUseCases'
import { supabaseObservationRepository } from '~/modules/tracking/infrastructure/persistence/supabaseObservationRepository'
import { supabaseSnapshotRepository } from '~/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository'
import { supabaseTrackingAlertRepository } from '~/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository'

// The original barrel used to wire a default singleton. Keep a single explicit
// file that only exports the singleton to avoid creating a barrel file.
export const trackingUseCases = createTrackingUseCases({
  snapshotRepository: supabaseSnapshotRepository,
  observationRepository: supabaseObservationRepository,
  trackingAlertRepository: supabaseTrackingAlertRepository,
})
