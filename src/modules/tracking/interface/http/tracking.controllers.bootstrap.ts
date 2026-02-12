import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'
import {
  createTrackingControllers,
  type TrackingControllers,
} from '~/modules/tracking/interface/http/tracking.controllers'

export type TrackingControllersBootstrapOverrides = Partial<{
  readonly usecases: TrackingUseCases
}>

export function bootstrapTrackingControllers(
  overrides: TrackingControllersBootstrapOverrides = {},
): TrackingControllers {
  const trackingUseCases = overrides.usecases ?? bootstrapTrackingModule().usecases
  return createTrackingControllers({ trackingUseCases })
}
