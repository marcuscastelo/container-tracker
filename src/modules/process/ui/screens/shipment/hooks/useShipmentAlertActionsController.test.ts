import { describe, expect, it, vi } from 'vitest'
import { runAlertActionBatch } from '~/modules/process/ui/screens/shipment/hooks/useShipmentAlertActionsController'

describe('runAlertActionBatch', () => {
  it('executes alert actions sequentially in input order', async () => {
    const executionOrder: string[] = []

    const result = await runAlertActionBatch({
      alertIds: ['alert-1', 'alert-2', 'alert-3'],
      execute: async (alertId) => {
        executionOrder.push(alertId)
      },
    })

    expect(executionOrder).toEqual(['alert-1', 'alert-2', 'alert-3'])
    expect(result).toEqual({
      completedAlertIds: ['alert-1', 'alert-2', 'alert-3'],
      failedAlertId: null,
      error: null,
    })
  })

  it('stops on the first failing alert and returns partial completion state', async () => {
    const executionOrder: string[] = []
    const failure = new Error('boom')
    const execute = vi.fn(async (alertId: string) => {
      executionOrder.push(alertId)
      if (alertId === 'alert-2') {
        throw failure
      }
    })

    const result = await runAlertActionBatch({
      alertIds: ['alert-1', 'alert-2', 'alert-3'],
      execute,
    })

    expect(executionOrder).toEqual(['alert-1', 'alert-2'])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(result.completedAlertIds).toEqual(['alert-1'])
    expect(result.failedAlertId).toBe('alert-2')
    expect(result.error).toBe(failure)
  })
})
