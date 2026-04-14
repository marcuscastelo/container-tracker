import {
  createWindowLifecycleController,
  setupSingleInstance,
} from '@agent/electron/window-controller'
import { describe, expect, it } from 'vitest'

function createWindowDouble() {
  const calls = {
    show: 0,
    hide: 0,
    focus: 0,
    restore: 0,
  }
  let visible = false
  let minimized = false

  return {
    window: {
      show() {
        calls.show += 1
        visible = true
      },
      hide() {
        calls.hide += 1
        visible = false
      },
      focus() {
        calls.focus += 1
      },
      isVisible() {
        return visible
      },
      isMinimized() {
        return minimized
      },
      restore() {
        calls.restore += 1
        minimized = false
      },
    },
    calls,
    setVisible(nextValue: boolean) {
      visible = nextValue
    },
    setMinimized(nextValue: boolean) {
      minimized = nextValue
    },
  }
}

describe('agent control UI window controller', () => {
  it('hides the window instead of closing it when tray mode is active', () => {
    const controller = createWindowLifecycleController({
      mode: 'tray',
    })
    const windowDouble = createWindowDouble()
    const closeEvent = {
      prevented: false,
      preventDefault() {
        this.prevented = true
      },
    }

    const intercepted = controller.handleWindowClose(closeEvent, windowDouble.window)

    expect(intercepted).toBe(true)
    expect(closeEvent.prevented).toBe(true)
    expect(windowDouble.calls.hide).toBe(1)
  })

  it('restores and focuses the window when a second instance arrives', () => {
    const controller = createWindowLifecycleController({
      mode: 'tray',
    })
    const windowDouble = createWindowDouble()
    windowDouble.setVisible(false)
    windowDouble.setMinimized(true)

    let secondInstanceListener: () => void = () => {
      throw new Error('second-instance listener was not registered')
    }
    let listenerRegistered = false
    const appDouble = {
      requestSingleInstanceLock() {
        return true
      },
      quit() {
        throw new Error('quit should not be called when lock is granted')
      },
      on(_event: 'second-instance', listener: () => void) {
        listenerRegistered = true
        secondInstanceListener = listener
      },
    }

    const initialized = setupSingleInstance({
      app: appDouble,
      onSecondInstance() {
        controller.openWindow(windowDouble.window)
      },
    })

    if (listenerRegistered) {
      secondInstanceListener()
    }

    expect(initialized).toBe(true)
    expect(windowDouble.calls.restore).toBe(1)
    expect(windowDouble.calls.show).toBe(1)
    expect(windowDouble.calls.focus).toBe(1)
  })

  it('quits immediately when the single-instance lock is unavailable', () => {
    let quitCalls = 0

    const initialized = setupSingleInstance({
      app: {
        requestSingleInstanceLock() {
          return false
        },
        quit() {
          quitCalls += 1
        },
        on() {
          throw new Error('on should not run without a lock')
        },
      },
      onSecondInstance() {
        throw new Error('should not register second-instance handler')
      },
    })

    expect(initialized).toBe(false)
    expect(quitCalls).toBe(1)
  })
})
