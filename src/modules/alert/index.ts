// Domain

// Application
export { type AlertUseCases, createAlertUseCases } from './application/alertUseCases'
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
} from './domain/alert'
export { type AlertRepository } from './domain/alertRepository'

// Infrastructure
export { supabaseAlertRepository } from './infrastructure/supabaseAlertRepository'

// Default use cases instance (using Supabase repository)
import { createAlertUseCases } from './application/alertUseCases'
import { supabaseAlertRepository } from './infrastructure/supabaseAlertRepository'

export const alertUseCases = createAlertUseCases(supabaseAlertRepository)
