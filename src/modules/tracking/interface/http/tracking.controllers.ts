import type { TrackingUseCases } from '~/modules/tracking/application/tracking.usecases'
import {
  type AlertsController,
  createAlertsController,
} from '~/modules/tracking/interface/http/tracking-alerts.controller'

export type TrackingControllersDeps = {
  readonly usecases: TrackingUseCases
}

export type TrackingControllers = {
  readonly alerts: AlertsController
}

export function createTrackingControllers(deps: TrackingControllersDeps): TrackingControllers {
  return {
    alerts: createAlertsController({
      usecases: deps.usecases,
    }),
  }
}
