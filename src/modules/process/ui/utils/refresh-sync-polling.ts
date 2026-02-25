export type RefreshSyncRequestStatus = 'PENDING' | 'LEASED' | 'DONE' | 'FAILED' | 'NOT_FOUND'

export type RefreshSyncStatusItem = {
  readonly syncRequestId: string
  readonly status: RefreshSyncRequestStatus
  readonly lastError: string | null
  readonly updatedAt: string | null
  readonly refValue: string | null
}

export type RefreshSyncStatusResponse = {
  readonly ok: true
  readonly allTerminal: boolean
  readonly requests: readonly RefreshSyncStatusItem[]
}

type RetryProgress = {
  readonly current: number
  readonly total: number
}

type PollRefreshSyncStatusCommand = {
  readonly syncRequestIds: readonly string[]
  readonly maxRetries: number
  readonly initialDelayMs: number
  readonly fetchSyncStatus: (
    syncRequestIds: readonly string[],
  ) => Promise<RefreshSyncStatusResponse>
  readonly onRetryStart?: (progress: RetryProgress) => void
  readonly shouldStop?: () => boolean
  readonly sleep?: (delayMs: number) => Promise<void>
}

export type PollRefreshSyncStatusResult =
  | {
      readonly kind: 'completed'
      readonly attempts: number
      readonly response: RefreshSyncStatusResponse
    }
  | {
      readonly kind: 'timeout'
      readonly attempts: number
      readonly lastResponse: RefreshSyncStatusResponse | null
    }
  | {
      readonly kind: 'cancelled'
      readonly attempts: number
      readonly lastResponse: RefreshSyncStatusResponse | null
    }

export function isTerminalSyncStatus(status: RefreshSyncRequestStatus): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'NOT_FOUND'
}

function areAllStatusesTerminal(response: RefreshSyncStatusResponse): boolean {
  return (
    response.allTerminal ||
    response.requests.every((requestStatus) => isTerminalSyncStatus(requestStatus.status))
  )
}

export function calculateExponentialBackoffDelay(
  attemptNumber: number,
  initialDelayMs: number,
): number {
  if (attemptNumber <= 1) {
    return initialDelayMs
  }

  return initialDelayMs * 2 ** (attemptNumber - 1)
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

export async function pollRefreshSyncStatus(
  command: PollRefreshSyncStatusCommand,
): Promise<PollRefreshSyncStatusResult> {
  const sleep = command.sleep ?? defaultSleep
  let lastResponse: RefreshSyncStatusResponse | null = null

  for (let attemptNumber = 1; attemptNumber <= command.maxRetries; attemptNumber += 1) {
    if (command.shouldStop?.() === true) {
      return { kind: 'cancelled', attempts: attemptNumber - 1, lastResponse }
    }

    command.onRetryStart?.({ current: attemptNumber, total: command.maxRetries })

    const delayMs = calculateExponentialBackoffDelay(attemptNumber, command.initialDelayMs)
    await sleep(delayMs)

    if (command.shouldStop?.() === true) {
      return { kind: 'cancelled', attempts: attemptNumber - 1, lastResponse }
    }

    lastResponse = await command.fetchSyncStatus(command.syncRequestIds)

    if (areAllStatusesTerminal(lastResponse)) {
      return {
        kind: 'completed',
        attempts: attemptNumber,
        response: lastResponse,
      }
    }
  }

  return {
    kind: 'timeout',
    attempts: command.maxRetries,
    lastResponse,
  }
}
