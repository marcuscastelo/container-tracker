import { createSignal, onCleanup } from 'solid-js'
import type { MotionDurationToken } from '~/shared/ui/motion/motion.tokens'
import {
  clearMotionTimeout,
  scheduleMotionFrame,
  scheduleMotionTimeout,
} from '~/shared/ui/motion/motion.utils'

type UseMotionOpenStateOptions = {
  readonly exitDuration?: MotionDurationToken
}

type UseMotionOpenStateResult = {
  readonly isOpen: () => boolean
  readonly isMounted: () => boolean
  readonly panelState: () => 'open' | 'closed'
  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
}

export function useMotionOpenState(options?: UseMotionOpenStateOptions): UseMotionOpenStateResult {
  const exitDuration = options?.exitDuration ?? 'base'
  const [isOpen, setIsOpen] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  let timeoutId: number | null = null

  const open = (): void => {
    clearMotionTimeout(timeoutId)
    setIsMounted(true)
    if (typeof window === 'undefined') {
      setIsOpen(true)
      return
    }

    scheduleMotionFrame(() => {
      setIsOpen(true)
    })
  }

  const close = (): void => {
    clearMotionTimeout(timeoutId)
    setIsOpen(false)
    timeoutId = scheduleMotionTimeout(() => {
      setIsMounted(false)
      timeoutId = null
    }, exitDuration)
  }

  const toggle = (): void => {
    if (isOpen()) {
      close()
      return
    }

    open()
  }

  onCleanup(() => {
    clearMotionTimeout(timeoutId)
  })

  return {
    isOpen,
    isMounted,
    panelState: () => (isOpen() ? 'open' : 'closed'),
    open,
    close,
    toggle,
  }
}
