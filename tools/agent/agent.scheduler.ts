type AgentRunReason = 'startup' | 'interval' | 'realtime' | 'coalesced'

type AgentSchedulerCommand = {
  readonly intervalMs: number
  readonly runCycle: (reason: AgentRunReason) => Promise<void>
  readonly onRunError: (command: {
    readonly reason: AgentRunReason
    readonly error: unknown
  }) => void
}

export type AgentScheduler = {
  readonly start: () => void
  readonly stop: () => void
  readonly triggerRun: (reason: Exclude<AgentRunReason, 'coalesced'>) => void
}

export function createAgentScheduler(command: AgentSchedulerCommand): AgentScheduler {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false
  let pendingWake = false
  let pendingReason: Exclude<AgentRunReason, 'coalesced'> | null = null

  const dequeueReason = (): AgentRunReason => {
    if (pendingReason) {
      const reason = pendingReason
      pendingReason = null
      return reason
    }
    return 'coalesced'
  }

  const runPendingCycles = async (initialReason: AgentRunReason): Promise<void> => {
    if (running) {
      if (initialReason !== 'coalesced') {
        pendingWake = true
        pendingReason = initialReason
      }
      return
    }

    running = true
    let reason: AgentRunReason = initialReason

    try {
      for (;;) {
        try {
          await command.runCycle(reason)
        } catch (error) {
          command.onRunError({ reason, error })
        }

        if (!pendingWake) {
          break
        }

        pendingWake = false
        reason = dequeueReason()
      }
    } finally {
      running = false
    }
  }

  const triggerRun = (reason: Exclude<AgentRunReason, 'coalesced'>): void => {
    void runPendingCycles(reason)
  }

  const start = (): void => {
    if (timer) return

    triggerRun('startup')
    timer = setInterval(() => {
      triggerRun('interval')
    }, command.intervalMs)
  }

  const stop = (): void => {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  return {
    start,
    stop,
    triggerRun,
  }
}

export type { AgentRunReason }
