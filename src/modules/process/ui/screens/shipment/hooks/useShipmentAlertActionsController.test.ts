import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const acknowledgeShipmentAlertMock = vi.hoisted(() => vi.fn(async () => undefined))
const unacknowledgeShipmentAlertMock = vi.hoisted(() => vi.fn(async () => undefined))

const translationKeys = vi.hoisted(() => ({
  shipmentView: {
    alerts: {
      action: {
        errorAcknowledge: 'Failed to acknowledge',
        errorUnacknowledge: 'Failed to unacknowledge',
      },
    },
  },
}))

vi.mock('~/modules/process/ui/screens/shipment/usecases/acknowledgeShipmentAlert.usecase', () => ({
  acknowledgeShipmentAlert: acknowledgeShipmentAlertMock,
}))

vi.mock(
  '~/modules/process/ui/screens/shipment/usecases/unacknowledgeShipmentAlert.usecase',
  () => ({
    unacknowledgeShipmentAlert: unacknowledgeShipmentAlertMock,
  }),
)

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: (value: string) => value,
    keys: translationKeys,
  }),
}))

import {
  runAlertActionBatch,
  useShipmentAlertActionsController,
} from '~/modules/process/ui/screens/shipment/hooks/useShipmentAlertActionsController'

type ControllerHarness = ReturnType<typeof useShipmentAlertActionsController> & {
  readonly dispose: () => void
  readonly setProcessId: (value: string) => void
}

type OriginalWindow = typeof globalThis.window | undefined

let originalWindow: OriginalWindow

function mountController(): ControllerHarness {
  return createRoot((dispose) => {
    const [processId, setProcessId] = createSignal('process-1')
    const controller = useShipmentAlertActionsController({
      processId,
      reconcileTrackingView: async () => undefined,
    })

    return {
      ...controller,
      dispose,
      setProcessId,
    }
  })
}

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

describe('useShipmentAlertActionsController', () => {
  beforeEach(() => {
    originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    })
  })

  afterEach(() => {
    acknowledgeShipmentAlertMock.mockReset()
    unacknowledgeShipmentAlertMock.mockReset()
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('marks changed alerts locally after acknowledge', async () => {
    vi.useFakeTimers()
    const controller = mountController()

    await controller.acknowledgeAlert('alert-7')

    expect(acknowledgeShipmentAlertMock).toHaveBeenCalledWith('alert-7')
    expect(controller.busyAlertIds().size).toBe(0)
    expect(controller.recentlyChangedAlertIds().has('alert-7')).toBe(true)

    vi.advanceTimersByTime(1_200)

    expect(controller.recentlyChangedAlertIds().has('alert-7')).toBe(false)
    controller.dispose()
    vi.useRealTimers()
  })

  it('clears local highlight state when the process changes', async () => {
    vi.useFakeTimers()
    const controller = mountController()

    await controller.unacknowledgeAlert('alert-9')
    expect(unacknowledgeShipmentAlertMock).toHaveBeenCalledWith('alert-9')
    expect(controller.recentlyChangedAlertIds().has('alert-9')).toBe(true)

    controller.setProcessId('process-2')
    vi.runAllTimers()
    await Promise.resolve()
    await Promise.resolve()

    expect(controller.recentlyChangedAlertIds().size).toBe(0)
    expect(controller.alertActionError()).toBe(null)
    controller.dispose()
    vi.useRealTimers()
  })
})
