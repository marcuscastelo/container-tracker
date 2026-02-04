// Domain

// Application
export {
  type AlertUseCases,
  createAlertUseCases,
} from '~/src/modules/alert/application/alertUseCases'
export {
  ALERT_METADATA,
  type Alert,
  type AlertCategory,
  type AlertCode,
  AlertSchema,
  type AlertSeverity,
  type AlertState,
  calculateAlertExpiration,
  createAlert,
  shouldAutoAcknowledge,
} from '~/src/modules/alert/domain/alert'
export { type AlertRepository } from '~/src/modules/alert/domain/alertRepository'

// Infrastructure
export { supabaseAlertRepository } from '~/src/modules/alert/infrastructure/supabaseAlertRepository'

// Default use cases instance (using Supabase repository)
import { createAlertUseCases } from '~/src/modules/alert/application/alertUseCases'
import { supabaseAlertRepository } from '~/src/modules/alert/infrastructure/supabaseAlertRepository'

export const alertUseCases = createAlertUseCases(supabaseAlertRepository)
