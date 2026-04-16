import { createSignal, onCleanup } from 'solid-js'
import type { MotionDurationToken } from '~/shared/ui/motion/motion.tokens'
import { clearMotionTimeout, scheduleMotionTimeout } from '~/shared/ui/motion/motion.utils'

type UseTransientFlagOptions = {
  readonly duration?: MotionDurationToken
}

type UseTransientFlagResult = {
  readonly isActive: () => boolean
  readonly activate: () => void
  readonly clear: () => void
}

export function useTransientFlag(options?: UseTransientFlagOptions): UseTransientFlagResult {
  const duration = options?.duration ?? 'highlight'
  const [isActive, setIsActive] = createSignal(false)
  let timeoutId: number | null = null

  const clear = (): void => {
    clearMotionTimeout(timeoutId)
    timeoutId = null
    setIsActive(false)
  }

  const activate = (): void => {
    clearMotionTimeout(timeoutId)
    setIsActive(true)
    timeoutId = scheduleMotionTimeout(() => {
      timeoutId = null
      setIsActive(false)
    }, duration)
  }

  onCleanup(() => {
    clearMotionTimeout(timeoutId)
  })

  return {
    isActive,
    activate,
    clear,
  }
}
