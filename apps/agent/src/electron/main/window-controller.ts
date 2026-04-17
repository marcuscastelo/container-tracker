export type UiLaunchMode = 'window' | 'tray'

export type UiWindowLike = {
  readonly show: () => void
  readonly hide: () => void
  readonly focus: () => void
  readonly isVisible: () => boolean
  readonly isMinimized: () => boolean
  readonly restore: () => void
}

export type UiCloseEventLike = {
  readonly preventDefault: () => void
}

export type UiAppLike = {
  readonly requestSingleInstanceLock: () => boolean
  readonly quit: () => void
  readonly on: (event: 'second-instance', listener: () => void) => void
}

export function createWindowLifecycleController(command: { readonly mode: UiLaunchMode }) {
  let quitting = false

  function openWindow(window: UiWindowLike): void {
    if (window.isMinimized()) {
      window.restore()
    }
    if (!window.isVisible()) {
      window.show()
    }
    window.focus()
  }

  return {
    mode: command.mode,
    shouldOpenOnReady(): boolean {
      return command.mode !== 'tray'
    },
    setQuitting(): void {
      quitting = true
    },
    handleWindowClose(event: UiCloseEventLike, window: UiWindowLike): boolean {
      if (command.mode !== 'tray' || quitting) {
        return false
      }

      event.preventDefault()
      window.hide()
      return true
    },
    openWindow,
  }
}

export function setupSingleInstance(command: {
  readonly app: UiAppLike
  readonly onSecondInstance: () => void
}): boolean {
  const hasLock = command.app.requestSingleInstanceLock()
  if (!hasLock) {
    command.app.quit()
    return false
  }

  command.app.on('second-instance', () => {
    command.onSecondInstance()
  })
  return true
}
