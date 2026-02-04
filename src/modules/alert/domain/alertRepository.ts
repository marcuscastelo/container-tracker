import type { Alert, AlertState } from '~/modules/alert/domain/alert'

/**
 * Alert Repository Interface
 *
 * Handles persistence of Alert entities.
 */
export type AlertRepository = {
  /**
   * Fetch all active alerts
   */
  fetchActive: () => Promise<readonly Alert[]>

  /**
   * Fetch alerts by process ID
   */
  fetchByProcessId: (processId: string) => Promise<readonly Alert[]>

  /**
   * Fetch alerts by container ID
   */
  fetchByContainerId: (containerId: string) => Promise<readonly Alert[]>

  /**
   * Fetch a single alert by ID
   */
  fetchById: (alertId: string) => Promise<Alert | null>

  /**
   * Check if an alert with the same code exists for a container/process
   * Used to avoid duplicate alerts
   */
  existsActiveByCode: (params: {
    code: string
    process_id?: string | null
    container_id?: string | null
  }) => Promise<boolean>

  /**
   * Create a new alert
   */
  create: (alert: Omit<Alert, 'id' | 'created_at' | 'updated_at'>) => Promise<Alert>

  /**
   * Create multiple alerts in a batch
   */
  createMany: (
    alerts: readonly Omit<Alert, 'id' | 'created_at' | 'updated_at'>[],
  ) => Promise<readonly Alert[]>

  /**
   * Update alert state (acknowledge/resolve)
   */
  updateState: (
    alertId: string,
    state: AlertState,
    extra?: {
      acknowledged_at?: Date | null
      resolved_at?: Date | null
      expires_at?: Date | null
    },
  ) => Promise<Alert>

  /**
   * Delete expired alerts (cleanup job)
   */
  deleteExpired: () => Promise<number>

  /**
   * Delete all alerts for a process (cascade on process delete)
   */
  deleteByProcessId: (processId: string) => Promise<void>
}
