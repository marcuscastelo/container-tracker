import { describe, expect, it, vi } from 'vitest'
import { createAgentScheduler } from '~/../tools/agent/agent.scheduler'

function createDeferredPromise<T = void>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
} {
  let resolvePromise: ((value: T) => void) | null = null

  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve(value: T) {
      if (resolvePromise) {
        resolvePromise(value)
      }
    },
  }
}

describe('agent scheduler', () => {
  it('runs one startup cycle when started', async () => {
    vi.useFakeTimers()
    const runCycle = vi.fn(async () => undefined)

    const scheduler = createAgentScheduler({
      intervalMs: 60_000,
      runCycle,
      onRunError: vi.fn(),
    })

    scheduler.start()
    await Promise.resolve()

    expect(runCycle).toHaveBeenCalledTimes(1)
    expect(runCycle).toHaveBeenCalledWith('startup')
    scheduler.stop()
    vi.useRealTimers()
  })

  it('wakes immediately on realtime trigger', async () => {
    vi.useFakeTimers()
    const runCycle = vi.fn(async () => undefined)

    const scheduler = createAgentScheduler({
      intervalMs: 60_000,
      runCycle,
      onRunError: vi.fn(),
    })

    scheduler.start()
    await Promise.resolve()

    scheduler.triggerRun('realtime')
    await Promise.resolve()

    expect(runCycle).toHaveBeenCalledTimes(2)
    expect(runCycle).toHaveBeenNthCalledWith(2, 'realtime')
    scheduler.stop()
    vi.useRealTimers()
  })

  it('coalesces multiple wakes during an active run', async () => {
    vi.useFakeTimers()

    const firstRun = createDeferredPromise()
    const runCycle = vi.fn(async () => {
      await firstRun.promise
    })

    const scheduler = createAgentScheduler({
      intervalMs: 60_000,
      runCycle,
      onRunError: vi.fn(),
    })

    scheduler.start()
    await Promise.resolve()
    expect(runCycle).toHaveBeenCalledTimes(1)

    scheduler.triggerRun('realtime')
    scheduler.triggerRun('interval')
    scheduler.triggerRun('realtime')

    firstRun.resolve(undefined)
    await Promise.resolve()
    await Promise.resolve()

    expect(runCycle).toHaveBeenCalledTimes(2)
    scheduler.stop()
    vi.useRealTimers()
  })

  it('keeps periodic interval sweep active', async () => {
    vi.useFakeTimers()
    const runCycle = vi.fn(async () => undefined)

    const scheduler = createAgentScheduler({
      intervalMs: 30_000,
      runCycle,
      onRunError: vi.fn(),
    })

    scheduler.start()
    await Promise.resolve()

    vi.advanceTimersByTime(30_000)
    await Promise.resolve()
    vi.advanceTimersByTime(30_000)
    await Promise.resolve()

    expect(runCycle).toHaveBeenCalledTimes(3)
    expect(runCycle).toHaveBeenNthCalledWith(1, 'startup')
    expect(runCycle).toHaveBeenNthCalledWith(2, 'interval')
    expect(runCycle).toHaveBeenNthCalledWith(3, 'interval')
    scheduler.stop()
    vi.useRealTimers()
  })

  it('reports cycle errors and continues running', async () => {
    vi.useFakeTimers()
    const onRunError = vi.fn()
    const runCycle = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    const scheduler = createAgentScheduler({
      intervalMs: 10_000,
      runCycle,
      onRunError,
    })

    scheduler.start()
    await Promise.resolve()

    vi.advanceTimersByTime(10_000)
    await Promise.resolve()

    expect(onRunError).toHaveBeenCalledTimes(1)
    expect(runCycle).toHaveBeenCalledTimes(2)
    scheduler.stop()
    vi.useRealTimers()
  })
})
