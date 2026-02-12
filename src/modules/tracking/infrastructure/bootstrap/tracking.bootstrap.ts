// src/modules/tracking/infrastructure/bootstrap/tracking.bootstrap.ts

import type { TrackingAlertRepository } from '~/modules/tracking/application/tracking.alert.repository'
import type { ObservationRepository } from '~/modules/tracking/application/tracking.observation.repository'
// Ports (agora em application, como você moveu)
import type { SnapshotRepository } from '~/modules/tracking/application/tracking.snapshot.repository'
import {
  createTrackingUseCases,
  type TrackingUseCases,
} from '~/modules/tracking/application/tracking.usecases'
import { supabaseObservationRepository } from '~/modules/tracking/infrastructure/persistence/supabaseObservationRepository'
// Repos (infra/persistence)
import { supabaseSnapshotRepository } from '~/modules/tracking/infrastructure/persistence/supabaseSnapshotRepository'
import { supabaseTrackingAlertRepository } from '~/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository'

export type TrackingBootstrapOverrides = Partial<{
  readonly snapshotRepository: SnapshotRepository
  readonly observationRepository: ObservationRepository
  readonly trackingAlertRepository: TrackingAlertRepository
}>

export type TrackingModule = {
  readonly usecases: TrackingUseCases
}

/**
 * Bootstrap do módulo tracking:
 * - escolhe implementações infra (supabase) para os ports
 * - cria facade de usecases com deps injetadas
 *
 * Overrides existem para testes / ambientes alternativos.
 */
export function bootstrapTrackingModule(
  overrides: TrackingBootstrapOverrides = {},
): TrackingModule {
  const snapshotRepository = overrides.snapshotRepository ?? supabaseSnapshotRepository
  const observationRepository = overrides.observationRepository ?? supabaseObservationRepository
  const trackingAlertRepository =
    overrides.trackingAlertRepository ?? supabaseTrackingAlertRepository

  const usecases = createTrackingUseCases({
    snapshotRepository,
    observationRepository,
    trackingAlertRepository,
  })

  return { usecases }
}
