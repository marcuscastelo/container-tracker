type LocalSyncFeedbackDocument = Pick<
  Document,
  'addEventListener' | 'removeEventListener' | 'visibilityState'
>

export type LocalSyncFeedbackEnvironment = {
  readonly document?: LocalSyncFeedbackDocument | undefined
}

export type LocalSyncFeedbackExpiryHandle = {
  readonly dispose: () => void
}

function resolveLocalSyncFeedbackDocument(
  environment?: LocalSyncFeedbackEnvironment,
): LocalSyncFeedbackDocument | undefined {
  if (environment?.document) {
    return environment.document
  }

  if (typeof document === 'undefined') {
    return undefined
  }

  return document
}

function isLocalSyncFeedbackDocumentVisible(
  currentDocument: LocalSyncFeedbackDocument | undefined,
): boolean {
  if (!currentDocument) {
    return true
  }

  return currentDocument.visibilityState === 'visible'
}

export function createLocalSyncFeedbackExpiryHandle(command: {
  readonly ttlMs: number
  readonly onExpire: () => void
}): LocalSyncFeedbackExpiryHandle {
  const timeoutId = setTimeout(() => {
    command.onExpire()
  }, command.ttlMs)

  return {
    dispose: () => {
      clearTimeout(timeoutId)
    },
  }
}

export function createVisibleLocalSyncFeedbackExpiryHandle(command: {
  readonly ttlMs: number
  readonly onExpire: () => void
  readonly environment?: LocalSyncFeedbackEnvironment
}): LocalSyncFeedbackExpiryHandle {
  const currentDocument = resolveLocalSyncFeedbackDocument(command.environment)
  if (!currentDocument) {
    return createLocalSyncFeedbackExpiryHandle({
      ttlMs: command.ttlMs,
      onExpire: command.onExpire,
    })
  }

  let remainingMs = command.ttlMs
  let countdownStartedAtMs: number | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const clearCountdown = (): void => {
    if (timeoutId === null) {
      return
    }

    clearTimeout(timeoutId)
    timeoutId = null
  }

  const stopVisibleCountdown = (): void => {
    if (countdownStartedAtMs === null) {
      clearCountdown()
      return
    }

    const elapsedMs = Date.now() - countdownStartedAtMs
    remainingMs = Math.max(0, remainingMs - elapsedMs)
    countdownStartedAtMs = null
    clearCountdown()
  }

  const cleanup = (): void => {
    currentDocument.removeEventListener('visibilitychange', handleVisibilityChange)
    clearCountdown()
    countdownStartedAtMs = null
  }

  const expire = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    cleanup()
    command.onExpire()
  }

  const startVisibleCountdown = (): void => {
    if (disposed || countdownStartedAtMs !== null) {
      return
    }

    if (!isLocalSyncFeedbackDocumentVisible(currentDocument)) {
      return
    }

    if (remainingMs <= 0) {
      expire()
      return
    }

    countdownStartedAtMs = Date.now()
    timeoutId = setTimeout(() => {
      remainingMs = 0
      countdownStartedAtMs = null
      expire()
    }, remainingMs)
  }

  function handleVisibilityChange(): void {
    if (disposed) {
      return
    }

    if (isLocalSyncFeedbackDocumentVisible(currentDocument)) {
      startVisibleCountdown()
      return
    }

    stopVisibleCountdown()
  }

  currentDocument.addEventListener('visibilitychange', handleVisibilityChange)
  startVisibleCountdown()

  return {
    dispose: () => {
      if (disposed) {
        return
      }

      disposed = true
      cleanup()
    },
  }
}

export function schedulePerProcessVisibleLocalSyncExpiry(command: {
  readonly processIds: readonly string[]
  readonly ttlMs: number
  readonly onExpire: (processId: string) => void
  readonly environment?: LocalSyncFeedbackEnvironment
}): ReadonlyMap<string, LocalSyncFeedbackExpiryHandle> {
  const expiryByProcessId = new Map<string, LocalSyncFeedbackExpiryHandle>()

  for (const processId of command.processIds) {
    const expiryCommand =
      command.environment === undefined
        ? {
            ttlMs: command.ttlMs,
            onExpire: () => {
              command.onExpire(processId)
            },
          }
        : {
            ttlMs: command.ttlMs,
            onExpire: () => {
              command.onExpire(processId)
            },
            environment: command.environment,
          }

    expiryByProcessId.set(processId, createVisibleLocalSyncFeedbackExpiryHandle(expiryCommand))
  }

  return expiryByProcessId
}

export function schedulePerProcessLocalSyncExpiry(command: {
  readonly processIds: readonly string[]
  readonly ttlMs: number
  readonly onExpire: (processId: string) => void
}): ReadonlyMap<string, LocalSyncFeedbackExpiryHandle> {
  const expiryByProcessId = new Map<string, LocalSyncFeedbackExpiryHandle>()

  for (const processId of command.processIds) {
    expiryByProcessId.set(
      processId,
      createLocalSyncFeedbackExpiryHandle({
        ttlMs: command.ttlMs,
        onExpire: () => {
          command.onExpire(processId)
        },
      }),
    )
  }

  return expiryByProcessId
}
