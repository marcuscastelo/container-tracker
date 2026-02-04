import type { Alert, AlertCode } from '../domain/alert'
import { calculateAlertExpiration, createAlert, shouldAutoAcknowledge } from '../domain/alert'
import type { AlertRepository } from '../domain/alertRepository'

/**
 * Alert Use Cases
 *
 * Application layer that orchestrates alert creation, acknowledgment, and resolution.
 */
export type AlertUseCases = {
  /**
   * Get all active alerts
   */
  getActiveAlerts: () => Promise<readonly Alert[]>

  /**
   * Get alerts for a specific process
   */
  getAlertsForProcess: (processId: string) => Promise<readonly Alert[]>

  /**
   * Get alerts for a specific container
   */
  getAlertsForContainer: (containerId: string) => Promise<readonly Alert[]>

  /**
   * Create a new alert (if not duplicate)
   * Returns the alert or null if a duplicate active alert exists
   */
  createAlert: (params: {
    process_id?: string | null
    container_id?: string | null
    code: AlertCode
    title: string
    description?: string | null
    related_event_ids?: readonly string[] | null
  }) => Promise<Alert | null>

  /**
   * Create initial alerts for a newly created process
   */
  createProcessCreatedAlerts: (params: {
    process_id: string
    container_ids: readonly string[]
  }) => Promise<readonly Alert[]>

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: (alertId: string) => Promise<Alert>

  /**
   * Resolve an alert (marks it as resolved and sets expiration)
   */
  resolveAlert: (alertId: string) => Promise<Alert>

  /**
   * Cleanup expired alerts
   */
  cleanupExpiredAlerts: () => Promise<number>
}

export function createAlertUseCases(repository: AlertRepository): AlertUseCases {
  return {
    async getActiveAlerts() {
      return repository.fetchActive()
    },

    async getAlertsForProcess(processId) {
      return repository.fetchByProcessId(processId)
    },

    async getAlertsForContainer(containerId) {
      return repository.fetchByContainerId(containerId)
    },

    async createAlert(params) {
      // Check for existing active alert with same code
      const exists = await repository.existsActiveByCode({
        code: params.code,
        process_id: params.process_id,
        container_id: params.container_id,
      })

      if (exists) {
        console.log(
          `Alert ${params.code} already exists for process=${params.process_id} container=${params.container_id}`,
        )
        return null
      }

      const alert = createAlert(params)
      const created = await repository.create(alert)

      // Auto-acknowledge if applicable
      if (shouldAutoAcknowledge(params.code)) {
        return repository.updateState(created.id, 'acknowledged', {
          acknowledged_at: new Date(),
        })
      }

      return created
    },

    async createProcessCreatedAlerts(params) {
      const alerts: Omit<Alert, 'id' | 'created_at' | 'updated_at'>[] = []

      // Create PROCESS_CREATED alert for the process
      alerts.push(
        createAlert({
          process_id: params.process_id,
          code: 'PROCESS_CREATED',
          title: 'Process registered in the system',
          description: 'This process is now being tracked.',
        }),
      )

      // Create ETA_MISSING alerts for each container
      for (const containerId of params.container_ids) {
        alerts.push(
          createAlert({
            process_id: params.process_id,
            container_id: containerId,
            code: 'ETA_MISSING',
            title: 'ETA not available',
            description: 'No expected arrival date is available for this container.',
          }),
        )
      }

      return repository.createMany(alerts)
    },

    async acknowledgeAlert(alertId) {
      return repository.updateState(alertId, 'acknowledged', {
        acknowledged_at: new Date(),
      })
    },

    async resolveAlert(alertId) {
      const alert = await repository.fetchById(alertId)
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`)
      }

      const now = new Date()
      const expiresAt = calculateAlertExpiration(now, alert.code)

      return repository.updateState(alertId, 'resolved', {
        resolved_at: now,
        expires_at: expiresAt,
      })
    },

    async cleanupExpiredAlerts() {
      return repository.deleteExpired()
    },
  }
}
