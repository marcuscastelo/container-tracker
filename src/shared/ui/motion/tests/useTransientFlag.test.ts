import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransientFlag } from '~/shared/ui/motion/useTransientFlag'

type Harness = ReturnType<typeof useTransientFlag> & { readonly dispose: () => void }
type OriginalWindow = typeof globalThis.window | undefined

let originalWindow: OriginalWindow

function mountHook(): Harness {
  return createRoot((dispose) => ({
    ...useTransientFlag(),
    dispose,
  }))
}

describe('useTransientFlag', () => {
  beforeEach(() => {
    originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('activates immediately and clears after the highlight duration', () => {
    vi.useFakeTimers()
    const hook = mountHook()

    hook.activate()
    expect(hook.isActive()).toBe(true)

    vi.advanceTimersByTime(1_200)
    expect(hook.isActive()).toBe(false)
    hook.dispose()
  })
})
