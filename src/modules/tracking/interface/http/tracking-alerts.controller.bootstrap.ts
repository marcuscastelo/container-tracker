/**
 * Composition root for the Alerts controller.
 *
 * Wires the controller with its tracking dependencies.
 * No business logic here — just DI wiring.
 */

import { createAlertsController } from '~/modules/tracking/interface/http/tracking-alerts.controller'
import { trackingUseCases } from '~/modules/tracking/trackingUseCases'

export const alertsController = createAlertsController({
  trackingUseCases,
})
