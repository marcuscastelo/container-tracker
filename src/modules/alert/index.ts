// Domain

// Application
export {
  type AlertUseCases,
  createAlertUseCases,
} from '~/modules/alert/application/alertUseCases'
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
} from '~/modules/alert/domain/alert'
export { type AlertRepository } from '~/modules/alert/domain/alertRepository'

// Infrastructure
export { supabaseAlertRepository } from '~/modules/alert/infrastructure/supabaseAlertRepository'

// Default use cases instance (using Supabase repository)
import { createAlertUseCases } from '~/modules/alert/application/alertUseCases'
import { supabaseAlertRepository } from '~/modules/alert/infrastructure/supabaseAlertRepository'

export const alertUseCases = createAlertUseCases(supabaseAlertRepository)
